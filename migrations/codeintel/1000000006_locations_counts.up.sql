BEGIN;

-- faster to supply default than manual update
ALTER TABLE lsif_data_definitions ADD COLUMN schema_version int DEFAULT 1 NOT NULL;
ALTER TABLE lsif_data_definitions ADD COLUMN num_locations int DEFAULT 0 NOT NULL;
ALTER TABLE lsif_data_references ADD COLUMN schema_version int DEFAULT 1 NOT NULL;
ALTER TABLE lsif_data_references ADD COLUMN num_locations int DEFAULT 0 NOT NULL;

-- drop default after all existing columns have been set
ALTER TABLE lsif_data_definitions ALTER COLUMN schema_version DROP DEFAULT;
ALTER TABLE lsif_data_definitions ALTER COLUMN num_locations DROP DEFAULT;
ALTER TABLE lsif_data_references ALTER COLUMN schema_version DROP DEFAULT;
ALTER TABLE lsif_data_references ALTER COLUMN num_locations DROP DEFAULT;

COMMENT ON COLUMN lsif_data_definitions.schema_version IS 'The schema version of this row - used to determine presence and encoding of data.';
COMMENT ON COLUMN lsif_data_definitions.num_locations IS 'The number of locations stored in the data field.';
COMMENT ON COLUMN lsif_data_references.schema_version IS 'The schema version of this row - used to determine presence and encoding of data.';
COMMENT ON COLUMN lsif_data_references.num_locations IS 'The number of locations stored in the data field.';

--
-- TODO - do the same thing for documents
--

--
--
--

-- TODO - comments
-- TODO - table comments
CREATE TABLE lsif_data_definitions_schema_version_counts (schema_version integer not null, num_records integer not null);
INSERT INTO lsif_data_definitions_schema_version_counts SELECT schema_version, count(*) FROM lsif_data_definitions GROUP BY schema_version;
CREATE UNIQUE INDEX lsif_data_definitions_schema_version_counts_schema_version ON lsif_data_definitions_schema_version_counts USING btree (schema_version);

CREATE OR REPLACE FUNCTION update_lsif_data_definitions_insert() RETURNS trigger AS $$ BEGIN
    INSERT INTO lsif_data_definitions_schema_version_counts
    SELECT schema_version, count(*) FROM newtab GROUP BY schema_version
    ON CONFLICT (schema_version) DO UPDATE SET num_records = lsif_data_definitions_schema_version_counts.num_records + EXCLUDED.num_records;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_lsif_data_definitions_update() RETURNS trigger AS $$ BEGIN
    INSERT INTO lsif_data_definitions_schema_version_counts
    SELECT schema_version, count(*) FROM newtab GROUP BY schema_version
    ON CONFLICT (schema_version) DO UPDATE SET num_records = lsif_data_definitions_schema_version_counts.num_records + EXCLUDED.num_records;

    WITH counts AS (SELECT schema_version, count(*) FROM oldtab GROUP BY schema_version)
    UPDATE lsif_data_definitions_schema_version_counts
    SET num_records = num_records - c.count
    FROM counts c WHERE lsif_data_definitions_schema_version_counts.schema_version = c.schema_version;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_lsif_data_definitions_delete() RETURNS trigger AS $$ BEGIN
    WITH counts AS (SELECT schema_version, count(*) FROM oldtab GROUP BY schema_version)
    UPDATE lsif_data_definitions_schema_version_counts
    SET num_records = num_records - c.count
    FROM counts c WHERE lsif_data_definitions_schema_version_counts.schema_version = c.schema_version;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER lsif_data_definitions_insert AFTER INSERT ON lsif_data_definitions REFERENCING NEW TABLE AS newtab FOR EACH STATEMENT EXECUTE PROCEDURE update_lsif_data_definitions_insert();
CREATE TRIGGER lsif_data_definitions_update AFTER UPDATE ON lsif_data_definitions REFERENCING NEW TABLE AS newtab OLD TABLE AS oldtab FOR EACH STATEMENT EXECUTE PROCEDURE update_lsif_data_definitions_update();
CREATE TRIGGER lsif_data_definitions_delete AFTER DELETE ON lsif_data_definitions REFERENCING OLD TABLE AS oldtab FOR EACH STATEMENT EXECUTE PROCEDURE update_lsif_data_definitions_delete();

--
--
--

-- TODO - comments
-- TODO - table comments
CREATE TABLE lsif_data_references_schema_version_counts (schema_version integer not null, num_records integer not null);
INSERT INTO lsif_data_references_schema_version_counts SELECT schema_version, count(*) FROM lsif_data_references GROUP BY schema_version;
CREATE UNIQUE INDEX lsif_data_references_schema_version_counts_schema_version ON lsif_data_references_schema_version_counts USING btree (schema_version);

CREATE OR REPLACE FUNCTION update_lsif_data_references_insert() RETURNS trigger AS $$ BEGIN
    INSERT INTO lsif_data_references_schema_version_counts
    SELECT schema_version, count(*) FROM newtab GROUP BY schema_version
    ON CONFLICT (schema_version) DO UPDATE SET num_records = lsif_data_references_schema_version_counts.num_records + EXCLUDED.num_records;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_lsif_data_references_update() RETURNS trigger AS $$ BEGIN
    INSERT INTO lsif_data_references_schema_version_counts
    SELECT schema_version, count(*) FROM newtab GROUP BY schema_version
    ON CONFLICT (schema_version) DO UPDATE SET num_records = lsif_data_references_schema_version_counts.num_records + EXCLUDED.num_records;

    WITH counts AS (SELECT schema_version, count(*) FROM oldtab GROUP BY schema_version)
    UPDATE lsif_data_references_schema_version_counts
    SET num_records = num_records - c.count
    FROM counts c WHERE lsif_data_references_schema_version_counts.schema_version = c.schema_version;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_lsif_data_references_delete() RETURNS trigger AS $$ BEGIN
    WITH counts AS (SELECT schema_version, count(*) FROM oldtab GROUP BY schema_version)
    UPDATE lsif_data_references_schema_version_counts
    SET num_records = num_records - c.count
    FROM counts c WHERE lsif_data_references_schema_version_counts.schema_version = c.schema_version;
    RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER lsif_data_references_insert AFTER INSERT ON lsif_data_references REFERENCING NEW TABLE AS newtab FOR EACH STATEMENT EXECUTE PROCEDURE update_lsif_data_references_insert();
CREATE TRIGGER lsif_data_references_update AFTER UPDATE ON lsif_data_references REFERENCING NEW TABLE AS newtab OLD TABLE AS oldtab FOR EACH STATEMENT EXECUTE PROCEDURE update_lsif_data_references_update();
CREATE TRIGGER lsif_data_references_delete AFTER DELETE ON lsif_data_references REFERENCING OLD TABLE AS oldtab FOR EACH STATEMENT EXECUTE PROCEDURE update_lsif_data_references_delete();

COMMIT;
