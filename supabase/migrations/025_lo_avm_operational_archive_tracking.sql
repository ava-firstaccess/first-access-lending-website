ALTER TABLE IF EXISTS loan_officer_avm_orders
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_path TEXT;

ALTER TABLE IF EXISTS avm_cache
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_path TEXT;

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_archived_at
  ON loan_officer_avm_orders (archived_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_avm_cache_archived_at
  ON avm_cache (archived_at, created_at DESC);

COMMENT ON COLUMN loan_officer_avm_orders.archived_at IS 'Timestamp when this raw operational row was successfully exported to long-term Azure Blob archive.';
COMMENT ON COLUMN loan_officer_avm_orders.archive_path IS 'Azure Blob path where this raw operational row was exported before hot-storage purge.';
COMMENT ON COLUMN avm_cache.archived_at IS 'Timestamp when this raw cache row was successfully exported to long-term Azure Blob archive.';
COMMENT ON COLUMN avm_cache.archive_path IS 'Azure Blob path where this raw cache row was exported before hot-storage purge.';
