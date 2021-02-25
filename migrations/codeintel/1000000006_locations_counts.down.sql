BEGIN;

-- TODO - comment
DROP TABLE lsif_data_definitions_schema_version_counts;
DROP TRIGGER lsif_data_definitions_insert ON lsif_data_definitions;
DROP TRIGGER lsif_data_definitions_update ON lsif_data_definitions;
DROP TRIGGER lsif_data_definitions_delete ON lsif_data_definitions;

-- TODO - comment
DROP TABLE lsif_data_references_schema_version_counts;
DROP TRIGGER lsif_data_references_insert ON lsif_data_references;
DROP TRIGGER lsif_data_references_update ON lsif_data_references;
DROP TRIGGER lsif_data_references_delete ON lsif_data_references;

-- TODO - comment
ALTER TABLE lsif_data_definitions DROP COLUMN IF EXISTS schema_version;
ALTER TABLE lsif_data_definitions DROP COLUMN IF EXISTS num_locations;
ALTER TABLE lsif_data_references DROP COLUMN IF EXISTS schema_version;
ALTER TABLE lsif_data_references DROP COLUMN IF EXISTS num_locations;

COMMIT;
