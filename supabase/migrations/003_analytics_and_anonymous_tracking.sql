-- Permanent analytics table (NOT subject to 30-day retention)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anonymous_id TEXT NOT NULL,
  session_stage TEXT NOT NULL,
  step_name TEXT NOT NULL,
  step_number INTEGER,
  total_steps INTEGER,
  referrer TEXT,
  user_agent TEXT,
  converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_anonymous ON analytics_events (anonymous_id);
CREATE INDEX IF NOT EXISTS idx_analytics_step ON analytics_events (session_stage, step_name);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events (created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on analytics_events"
  ON analytics_events FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- Anonymous tracking columns on applications
ALTER TABLE applications ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS anonymous_id TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS referrer TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS user_agent TEXT;
CREATE INDEX IF NOT EXISTS idx_app_anonymous_id ON applications (anonymous_id) WHERE anonymous_id IS NOT NULL;
