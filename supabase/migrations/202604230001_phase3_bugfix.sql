-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 Bug Fix Migration
-- Fixes wallet balance display and adds missing columns
-- Run in Supabase SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add venue_id column to token_ledger if it doesn't exist
--    (referenced in validate-scan deduction inserts)
ALTER TABLE token_ledger
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES venues(id);

-- 2. Ensure session_id FK exists on token_ledger
--    (the initial migration deferred this — add it safely)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'token_ledger_session_fk'
  ) THEN
    ALTER TABLE token_ledger
      ADD CONSTRAINT token_ledger_session_fk
        FOREIGN KEY (session_id) REFERENCES sessions(id);
  END IF;
END $$;

-- 3. Drop and recreate the wallet_balance view with corrected logic
--    The original view was correct but let's ensure it matches the API route logic
DROP VIEW IF EXISTS wallet_balance;

CREATE OR REPLACE VIEW wallet_balance AS
SELECT
  user_id,
  SUM(CASE
    WHEN type IN ('purchase', 'compensation', 'refund')
         AND (expires_at IS NULL OR expires_at > NOW())
    THEN amount
    WHEN type IN ('deduction', 'penalty', 'grace_deduction')
    THEN amount   -- these are already negative in the DB
    ELSE 0
  END) AS available_tokens,
  SUM(CASE
    WHEN type = 'purchase'
         AND expires_at IS NOT NULL
         AND expires_at <= NOW()
         AND grace_expires_at IS NOT NULL
         AND grace_expires_at > NOW()
    THEN amount / 2
    ELSE 0
  END) AS grace_tokens,
  MIN(CASE
    WHEN type IN ('purchase', 'compensation')
         AND expires_at IS NOT NULL
         AND expires_at > NOW()
    THEN expires_at
  END) AS earliest_expiry
FROM token_ledger
GROUP BY user_id;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON wallet_balance TO authenticated;

-- 4. Fix the RLS policy on token_ledger so authenticated users can SELECT
--    their own rows (needed for balance computation in API routes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'token_ledger' AND policyname = 'ledger_user_read'
  ) THEN
    CREATE POLICY ledger_user_read ON token_ledger FOR SELECT
      USING (user_id = get_user_id());
  END IF;
END $$;

-- 5. Ensure sessions RLS policies exist (idempotent)
DO $$
BEGIN
  -- Service role full access (covers validate-scan and auto-close)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sessions' AND policyname = 'sessions_service_all'
  ) THEN
    CREATE POLICY sessions_service_all ON sessions FOR ALL
      USING (auth.role() = 'service_role');
  END IF;

  -- Users can read own sessions
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'sessions' AND policyname = 'sessions_user_read'
  ) THEN
    CREATE POLICY sessions_user_read ON sessions FOR SELECT
      USING (user_id = get_user_id() OR get_user_role() IN ('admin', 'gym_owner'));
  END IF;
END $$;

-- 6. Ensure bookings service_role policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'bookings' AND policyname = 'bookings_service_all'
  ) THEN
    CREATE POLICY bookings_service_all ON bookings FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 7. Ensure audit_log service_role policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log' AND policyname = 'audit_service_all'
  ) THEN
    CREATE POLICY audit_service_all ON audit_log FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 8. Token ledger service_role policy (for deduction inserts from API routes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'token_ledger' AND policyname = 'ledger_service_all'
  ) THEN
    CREATE POLICY ledger_service_all ON token_ledger FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- 9. Add scan_method columns to sessions if missing
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS scan_method_entry scan_method,
  ADD COLUMN IF NOT EXISTS scan_method_exit  scan_method,
  ADD COLUMN IF NOT EXISTS peak_multiplier_used NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS commitment_discount   NUMERIC(3,2) NOT NULL DEFAULT 0;

-- Done
DO $$ BEGIN RAISE NOTICE 'Phase 3 bug fix migration complete.'; END $$;
