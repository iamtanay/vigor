-- ─────────────────────────────────────────────────────────────────────────────
-- Vigor — Phase 4: Gym Owner Portal
-- 202604240001_phase4_gym_portal.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Fix the original broken venues_owner_update policy ───────────────────
-- The original WITH CHECK had a self-referencing subquery on venues
-- (AND tier = (SELECT tier FROM venues WHERE id = venues.id)) which throws
-- "more than one row returned by a subquery" when multiple venue rows exist.
-- Tier changes are already blocked at the API layer via EDITABLE_FIELDS.

DROP POLICY IF EXISTS venues_owner_update ON venues;
DROP POLICY IF EXISTS "Gym owner updates own venue" ON venues;

CREATE POLICY venues_owner_update ON venues FOR UPDATE
  USING (
    owner_user_id = get_user_id()
    AND get_user_role() = 'gym_owner'
  )
  WITH CHECK (
    owner_user_id = get_user_id()
  );

-- ─── 2. Sessions: gym owner can read sessions for their venue ─────────────────

DROP POLICY IF EXISTS "Gym owner reads venue sessions" ON sessions;

CREATE POLICY "Gym owner reads venue sessions"
  ON sessions FOR SELECT
  USING (
    venue_id IN (
      SELECT id FROM venues
      WHERE owner_user_id = get_user_id()
    )
  );

-- ─── 3. Bookings: gym owner can read bookings for their venue ─────────────────

DROP POLICY IF EXISTS "Gym owner reads venue bookings" ON bookings;

CREATE POLICY "Gym owner reads venue bookings"
  ON bookings FOR SELECT
  USING (
    venue_id IN (
      SELECT id FROM venues
      WHERE owner_user_id = get_user_id()
    )
  );

-- ─── 4. Ratings ───────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Gym owner reads venue ratings" ON ratings;

CREATE POLICY "Gym owner reads venue ratings"
  ON ratings FOR SELECT
  USING (
    venue_id IN (
      SELECT id FROM venues
      WHERE owner_user_id = get_user_id()
    )
  );

DROP POLICY IF EXISTS "Users read own ratings" ON ratings;

CREATE POLICY "Users read own ratings"
  ON ratings FOR SELECT
  USING (
    user_id = get_user_id()
  );

-- ─── 5. Settlements ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Gym owner reads own settlements" ON settlements;

CREATE POLICY "Gym owner reads own settlements"
  ON settlements FOR SELECT
  USING (
    venue_id IN (
      SELECT id FROM venues
      WHERE owner_user_id = get_user_id()
    )
  );

-- ─── 6. Token ledger: gym owner reads deductions for their venue sessions ─────

DROP POLICY IF EXISTS "Gym owner reads venue token deductions" ON token_ledger;

CREATE POLICY "Gym owner reads venue token deductions"
  ON token_ledger FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN venues v ON v.id = s.venue_id
      WHERE v.owner_user_id = get_user_id()
    )
  );

-- ─── 7. Audit log: gym owner reads audit events for their venue ───────────────

DROP POLICY IF EXISTS "Gym owner reads venue audit log" ON audit_log;

CREATE POLICY "Gym owner reads venue audit log"
  ON audit_log FOR SELECT
  USING (
    venue_id IN (
      SELECT id FROM venues
      WHERE owner_user_id = get_user_id()
    )
  );

-- ─── 8. Settlement preview helper function ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_settlement_preview(
  p_venue_id  UUID,
  p_start     TIMESTAMPTZ,
  p_end       TIMESTAMPTZ
)
RETURNS TABLE (
  tokens_consumed BIGINT,
  session_count   BIGINT,
  avg_session_dur NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COALESCE(SUM(ABS(tl.amount)), 0)::BIGINT  AS tokens_consumed,
    COUNT(DISTINCT s.id)::BIGINT               AS session_count,
    COALESCE(
      AVG(
        EXTRACT(EPOCH FROM (s.exit_scanned_at - s.entry_scanned_at))
      ), 0
    )::NUMERIC                                 AS avg_session_dur
  FROM sessions s
  LEFT JOIN token_ledger tl
    ON tl.session_id = s.id
   AND tl.type = 'deduction'
  WHERE s.venue_id = p_venue_id
    AND s.status IN ('closed', 'auto_closed')
    AND s.exit_scanned_at BETWEEN p_start AND p_end;
$$;

REVOKE ALL ON FUNCTION get_settlement_preview FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_settlement_preview TO service_role;