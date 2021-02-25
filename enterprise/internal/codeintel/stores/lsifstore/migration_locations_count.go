package lsifstore

import (
	"context"
	"database/sql"

	"github.com/keegancsmith/sqlf"

	"github.com/sourcegraph/sourcegraph/internal/database/basestore"
	"github.com/sourcegraph/sourcegraph/internal/oobmigration"
)

type locationsCountMigrator struct {
	store      *Store
	serializer *serializer
	tableQuery *sqlf.Query
}

// DefinitionsCountMigrationID is the primary key of the migration record an instance of
// definitionsCountMigrator handles. This is associated with the out-of-band migration
// record inserted in migrations/frontend/1528395788_location_counts_migration.up.sql.
const DefinitionsCountMigrationID = 2

// ReferencesCountMigrationID is the primary key of the migration record an instance of
// definitionsCountMigrator handles. This is associated with the out-of-band migration
// record inserted in migrations/frontend/1528395788_location_counts_migration.up.sql.
const ReferencesCountMigrationID = 3

// NewLocationsCountMigrator creates a new Migrator instance that reads records from either
// the lsif_data_definitions or lsif_data_references table and populates their num_locations
// value based on their decoded payload. This will update rows with a schema_version of 1,
// and will set the row's schema version to 2 after processing.
func NewLocationsCountMigrator(store *Store, tableName string) oobmigration.Migrator {
	return &locationsCountMigrator{
		store:      store,
		serializer: newSerializer(),
		tableQuery: sqlf.Sprintf(tableName),
	}
}

// Progress returns the ratio of migrated records to total records. Any record with a
// schema version of two or greater is considered migrated.
func (m *locationsCountMigrator) Progress(ctx context.Context) (float64, error) {
	progress, _, err := basestore.ScanFirstFloat(m.store.Query(ctx, sqlf.Sprintf(locationsCountMigratorProgressQuery, m.tableQuery, m.tableQuery)))
	if err != nil {
		return 0, err
	}

	return progress, nil
}

//
// TODO - redocument

const locationsCountMigratorProgressQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/migration_definitions_count.go:Progress
SELECT CASE c2.count WHEN 0 THEN 1 ELSE cast(c1.count as float) / cast(c2.count as float) END FROM
	(SELECT sum(num_records) as count FROM %s_schema_version_counts WHERE schema_version >= 2) c1,
	(SELECT sum(num_records) as count FROM %s_schema_version_counts) c2
`

// LocationCountMigrationBatchSize is the number of records that should be selected for
// update in a single invocation of Up.
const LocationCountMigrationBatchSize = 1000

// Up reads records with a schema version of 1, decodes their data payload, then writes
// the number of locations in the payload back to the record. The schema version of the
// modified row will be bumped to 2.
func (m *locationsCountMigrator) Up(ctx context.Context) error {
	tx, err := m.store.Transact(ctx)
	if err != nil {
		return err
	}
	defer func() { err = tx.Done(err) }()

	counts, err := m.scanLocationCounts(tx.Query(ctx, sqlf.Sprintf(locationsCountMigratorSelectQuery, m.tableQuery, LocationCountMigrationBatchSize)))
	if err != nil {
		return err
	}

	for _, c := range counts {
		if _, err := basestore.ScanInts(tx.Query(ctx, sqlf.Sprintf(locationsCountMigratorUpdateQuery, m.tableQuery, c.NumLocations, c.DumpID, c.Scheme, c.Identifier))); err != nil {
			return err
		}
	}

	return nil
}

const locationsCountMigratorSelectQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/migration_locations_count.go:Up
SELECT dump_id, scheme, identifier, data
FROM %s
WHERE schema_version = 1
LIMIT %s
FOR UPDATE SKIP LOCKED
`

const locationsCountMigratorUpdateQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/migration_locations_count.go:Up
UPDATE %s
SET num_locations = %s, schema_version = 2
WHERE dump_id = %s AND scheme = %s AND identifier = %s
`

// Down is a no-op as the up migration is non-destructive and previous clients can still
// read. We do reset the schema_version, though, so we can have Progress report 0% in the
// event of a downgrade.
//
// This mainly exists to aid in UI/UX. This is not strictly necessary for this migration,
// as there are no previous migrations that depend on a schema version of one. This is
// mainly done to prevent copy and paste errors errors in the future when we have chains
// of schema versions depending on one another.
func (m *locationsCountMigrator) Down(ctx context.Context) error {
	return m.store.Exec(ctx, sqlf.Sprintf(locationsCountMigratorDownQuery, m.tableQuery, LocationCountMigrationBatchSize, m.tableQuery))
}

const locationsCountMigratorDownQuery = `
-- source: enterprise/internal/codeintel/stores/lsifstore/migration_locations_count.go:Down
WITH batch AS (
	SELECT dump_id, scheme, identifier
	FROM %s
	WHERE schema_version = 2
	LIMIT %d
	FOR UPDATE SKIP LOCKED
)
UPDATE %s SET schema_version = 1 WHERE (dump_id, scheme, identifier) IN (SELECT * FROM batch)
`

type locationCount struct {
	DumpID       int
	Scheme       string
	Identifier   string
	NumLocations int
}

// scsanLocationCounts scans a slice of locationCount values from the return value of `*Store.query`.
func (m *locationsCountMigrator) scanLocationCounts(rows *sql.Rows, queryErr error) (_ []locationCount, err error) {
	if queryErr != nil {
		return nil, queryErr
	}
	defer func() { err = basestore.CloseRows(rows, err) }()

	var values []locationCount
	for rows.Next() {
		var record locationCount
		var rawData []byte
		if err := rows.Scan(&record.DumpID, &record.Scheme, &record.Identifier, &rawData); err != nil {
			return nil, err
		}

		data, err := m.serializer.UnmarshalLocations(rawData)
		if err != nil {
			return nil, err
		}
		record.NumLocations = len(data)

		values = append(values, record)
	}

	return values, nil
}
