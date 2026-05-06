ALTER TABLE IF EXISTS loan_officer_avm_run_results
  RENAME TO loan_officer_avm_analytics_runs;

ALTER TABLE IF EXISTS loan_officer_avm_run_providers
  RENAME TO loan_officer_avm_analytics_providers;

ALTER TABLE IF EXISTS loan_officer_avm_orders
  RENAME TO loan_officer_avm_order_log;

ALTER INDEX IF EXISTS idx_loan_officer_avm_run_results_order_run_id
  RENAME TO idx_loan_officer_avm_analytics_runs_order_run_id;
ALTER INDEX IF EXISTS idx_loan_officer_avm_run_results_created_at
  RENAME TO idx_loan_officer_avm_analytics_runs_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_run_results_officer_created_at
  RENAME TO idx_loan_officer_avm_analytics_runs_officer_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_run_results_run_source_created_at
  RENAME TO idx_loan_officer_avm_analytics_runs_run_source_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_run_results_winner_created_at
  RENAME TO idx_loan_officer_avm_analytics_runs_winner_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_run_results_investor_created_at
  RENAME TO idx_loan_officer_avm_analytics_runs_investor_created_at;

ALTER INDEX IF EXISTS idx_loan_officer_avm_run_providers_run_provider
  RENAME TO idx_loan_officer_avm_analytics_providers_run_provider;
ALTER INDEX IF EXISTS idx_loan_officer_avm_run_providers_provider_created_at
  RENAME TO idx_loan_officer_avm_analytics_providers_provider_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_run_providers_provider_winner_created_at
  RENAME TO idx_loan_officer_avm_analytics_providers_provider_winner_created_at;

ALTER INDEX IF EXISTS idx_loan_officer_avm_orders_run_id_unique
  RENAME TO idx_loan_officer_avm_order_log_run_id_unique;
ALTER INDEX IF EXISTS idx_loan_officer_avm_orders_loan_number_created_at
  RENAME TO idx_loan_officer_avm_order_log_loan_number_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_orders_provider_created_at
  RENAME TO idx_loan_officer_avm_order_log_provider_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_orders_officer_created_at
  RENAME TO idx_loan_officer_avm_order_log_officer_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_orders_external_order_id
  RENAME TO idx_loan_officer_avm_order_log_external_order_id;
ALTER INDEX IF EXISTS idx_loan_officer_avm_orders_hc_cycle_product
  RENAME TO idx_loan_officer_avm_order_log_hc_cycle_product;
ALTER INDEX IF EXISTS idx_loan_officer_avm_orders_investor_threshold_created_at
  RENAME TO idx_loan_officer_avm_order_log_investor_threshold_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_orders_run_source_created_at
  RENAME TO idx_loan_officer_avm_order_log_run_source_created_at;
ALTER INDEX IF EXISTS idx_loan_officer_avm_orders_archived_at
  RENAME TO idx_loan_officer_avm_order_log_archived_at;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loan_officer_avm_run_providers_run_id_fkey'
  ) THEN
    ALTER TABLE loan_officer_avm_analytics_providers
      RENAME CONSTRAINT loan_officer_avm_run_providers_run_id_fkey
      TO loan_officer_avm_analytics_providers_run_id_fkey;
  END IF;
END $$;

DROP POLICY IF EXISTS "Service role full access on loan_officer_avm_run_results" ON loan_officer_avm_analytics_runs;
CREATE POLICY "Service role full access on loan_officer_avm_analytics_runs"
  ON loan_officer_avm_analytics_runs FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access on loan_officer_avm_run_providers" ON loan_officer_avm_analytics_providers;
CREATE POLICY "Service role full access on loan_officer_avm_analytics_providers"
  ON loan_officer_avm_analytics_providers FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access on loan_officer_avm_orders" ON loan_officer_avm_order_log;
CREATE POLICY "Service role full access on loan_officer_avm_order_log"
  ON loan_officer_avm_order_log FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE loan_officer_avm_analytics_runs IS 'Persistent run-level LO AVM analytics fact table. One row per user-triggered AVM run.';
COMMENT ON TABLE loan_officer_avm_analytics_providers IS 'Persistent provider-level LO AVM analytics fact table. One row per provider considered within a user-triggered AVM run.';
COMMENT ON TABLE loan_officer_avm_order_log IS 'Raw outbound LO AVM vendor-order log retained in hot Supabase storage for a limited window before archive and purge. This is not the result cache.';
COMMENT ON COLUMN loan_officer_avm_order_log.archived_at IS 'Timestamp when this raw order-log row was successfully exported to long-term Azure Blob archive.';
COMMENT ON COLUMN loan_officer_avm_order_log.archive_path IS 'Azure Blob path where this raw order-log row was exported before hot-storage purge.';
