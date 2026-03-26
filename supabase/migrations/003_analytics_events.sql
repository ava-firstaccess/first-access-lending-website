-- Permanent analytics table - NOT subject to 30-day retention
-- Lightweight: only stores step transitions, not full form data

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anonymous_id TEXT NOT NULL,          -- persistent client UUID
  session_stage TEXT NOT NULL,         -- 'stage1' or 'stage2'
  step_name TEXT NOT NULL,             -- e.g. 'product', 'address', 'borrowerInfo'
  step_number INTEGER,                 -- numeric index
  total_steps INTEGER,                 -- total in current stage
  referrer TEXT,                       -- UTM source or document.referrer
  user_agent TEXT,                     -- device/browser info
  converted BOOLEAN DEFAULT FALSE,     -- true if they eventually submitted
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for funnel queries
CREATE INDEX idx_analytics_anonymous ON analytics_events (anonymous_id);
CREATE INDEX idx_analytics_step ON analytics_events (session_stage, step_name);
CREATE INDEX idx_analytics_created ON analytics_events (created_at);

-- RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on analytics_events"
  ON analytics_events FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
