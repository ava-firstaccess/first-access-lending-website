-- Remove borrower name fields and raw error_message from MeridianLink hot storage.
-- Keep only operationally necessary identifiers in the live table.

ALTER TABLE IF EXISTS meridianlink_runs
  DROP COLUMN IF EXISTS error_message,
  DROP COLUMN IF EXISTS borrower_first_name,
  DROP COLUMN IF EXISTS borrower_last_name,
  DROP COLUMN IF EXISTS approved_borrower_first_name,
  DROP COLUMN IF EXISTS approved_borrower_last_name;
