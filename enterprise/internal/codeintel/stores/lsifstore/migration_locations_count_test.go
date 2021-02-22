package lsifstore

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/keegancsmith/sqlf"

	"github.com/sourcegraph/sourcegraph/internal/database/basestore"
	"github.com/sourcegraph/sourcegraph/internal/database/dbconn"
	"github.com/sourcegraph/sourcegraph/internal/database/dbtesting"
	"github.com/sourcegraph/sourcegraph/internal/observation"
)

func TestLocationsCountMigrator(t *testing.T) {
	if testing.Short() {
		t.Skip()
	}
	dbtesting.SetupGlobalTestDB(t)
	store := NewStore(dbconn.Global, &observation.TestContext)
	migrator := NewLocationsCountMigrator(store, "lsif_data_definitions")
	serializer := newSerializer()

	assertProgress := func(expectedProgress float64) {
		if progress, err := migrator.Progress(context.Background()); err != nil {
			t.Fatalf("unexpected error querying progress: %s", err)
		} else if progress != expectedProgress {
			t.Errorf("unexpected progress. want=%.2f have=%.2f", expectedProgress, progress)
		}
	}

	assertCounts := func(expectedCounts []int) {
		query := sqlf.Sprintf(`SELECT num_locations FROM lsif_data_definitions ORDER BY scheme, identifier`)

		if counts, err := basestore.ScanInts(store.Query(context.Background(), query)); err != nil {
			t.Fatalf("unexpected error querying num locations: %s", err)
		} else if diff := cmp.Diff(expectedCounts, counts); diff != "" {
			t.Errorf("unexpected counts (-want +got):\n%s", diff)
		}
	}

	n := LocationCountMigrationBatchSize * 2
	expectedCounts := make([]int, 0, n)
	locations := make([]LocationData, 0, n)

	for i := 0; i < n; i++ {
		expectedCounts = append(expectedCounts, i+1)
		locations = append(locations, LocationData{URI: fmt.Sprintf("U%d", i)})

		data, err := serializer.MarshalLocations(locations)
		if err != nil {
			t.Fatalf("unexpected error serializing location data: %s", err)
		}

		if err := store.Exec(context.Background(), sqlf.Sprintf(
			"INSERT INTO lsif_data_definitions (dump_id, scheme, identifier, data, schema_version, num_locations) VALUES (42, %s, %s, %s, 1, 0)",
			fmt.Sprintf("s%04d", i),
			fmt.Sprintf("i%04d", i),
			data,
		)); err != nil {
			t.Fatalf("unexpected error inserting row: %s", err)
		}
	}

	assertProgress(0)

	if err := migrator.Up(context.Background()); err != nil {
		t.Fatalf("unexpected error performing up migration: %s", err)
	}
	assertProgress(0.5)

	if err := migrator.Up(context.Background()); err != nil {
		t.Fatalf("unexpected error performing up migration: %s", err)
	}
	assertProgress(1)

	assertCounts(expectedCounts)

	if err := migrator.Down(context.Background()); err != nil {
		t.Fatalf("unexpected error performing down migration: %s", err)
	}
	assertProgress(0.5)

	if err := migrator.Down(context.Background()); err != nil {
		t.Fatalf("unexpected error performing down migration: %s", err)
	}
	assertProgress(0)
}
