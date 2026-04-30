ALTER TABLE avm_cache
  ADD COLUMN IF NOT EXISTS final_value BIGINT,
  ADD COLUMN IF NOT EXISTS final_provider TEXT,
  ADD COLUMN IF NOT EXISTS final_fsd NUMERIC,
  ADD COLUMN IF NOT EXISTS final_new_max_loan BIGINT;

UPDATE avm_cache
SET
  final_value = COALESCE(
    NULLIF(response_payload->>'hcValue', '')::BIGINT,
    final_value
  ),
  final_provider = COALESCE(
    NULLIF(response_payload->>'valuationProvider', ''),
    final_provider
  ),
  final_fsd = COALESCE(
    NULLIF(response_payload->>'finalFsd', '')::NUMERIC,
    NULLIF(response_payload->>'fsd', '')::NUMERIC,
    NULLIF(response_payload->>'houseCanaryFsd', '')::NUMERIC,
    NULLIF(response_payload->>'clearCapitalForecastStdDev', '')::NUMERIC,
    final_fsd
  ),
  final_new_max_loan = COALESCE(
    NULLIF(response_payload->>'newMaxLoan', '')::BIGINT,
    final_new_max_loan
  ),
  hc_estimate = NULL,
  hc_value = NULL,
  fsd = NULL,
  new_max_loan = NULL;
