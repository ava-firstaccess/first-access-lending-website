ALTER TABLE IF EXISTS applications
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_path TEXT;

CREATE INDEX IF NOT EXISTS idx_applications_archived_at
  ON applications (archived_at, created_at DESC);

COMMENT ON COLUMN applications.archived_at IS 'Timestamp when this application row was successfully exported to long-term Azure Blob archive.';
COMMENT ON COLUMN applications.archive_path IS 'Azure Blob path where this application row was exported before hot-storage purge.';
