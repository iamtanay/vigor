-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 RLS & Policy Additions
-- Enables Next.js API routes (running as authed user) to:
--   - INSERT and UPDATE sessions (open/close lifecycle)
--   - INSERT audit_log entries for scan events (via service-role or user)
--   - UPDATE bookings to 'completed' status after exit scan
--   - UPDATE entry_qr_used on bookings (mark QR consumed)
-- All token deductions still write to token_ledger as the authed user.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── sessions ────────────────────────────────────────────────────────────────

-- Users can read their own sessions
CREATE POLICY sessions_user_read ON sessions FOR SELECT
  USING (user_id = get_user_id() OR get_user_role() IN ('admin', 'gym_owner'));

-- Allow INSERT of sessions when booking belongs to user
-- (Entry scan creates the session record)
CREATE POLICY sessions_insert_on_entry ON sessions FOR INSERT
  WITH CHECK (user_id = get_user_id() OR get_user_role() IN ('admin'));

-- Allow UPDATE of sessions (exit scan closes them; auto-close also)
-- Broad update policy — application logic enforces state machine
CREATE POLICY sessions_update_lifecycle ON sessions FOR UPDATE
  USING (user_id = get_user_id() OR get_user_role() IN ('admin'))
  WITH CHECK (TRUE);

-- Service role can do everything (for server-side API routes using service client)
CREATE POLICY sessions_service_all ON sessions FOR ALL
  USING (auth.role() = 'service_role');

-- ─── bookings — allow marking 'completed' after exit scan ────────────────────

-- New policy: allow updating booking status to 'completed' for own bookings
CREATE POLICY bookings_user_complete ON bookings FOR UPDATE
  USING (user_id = get_user_id() AND status = 'confirmed')
  WITH CHECK (user_id = get_user_id() AND status = 'completed');

-- Allow updating entry_qr_used and entry_qr_hash fields on own bookings
CREATE POLICY bookings_user_qr_fields ON bookings FOR UPDATE
  USING (user_id = get_user_id())
  WITH CHECK (user_id = get_user_id());

-- Service role full access (API routes using admin client)
CREATE POLICY bookings_service_all ON bookings FOR ALL
  USING (auth.role() = 'service_role');

-- ─── audit_log — allow scan events from authenticated users ──────────────────
-- Phase 2 added admin insert. Phase 3 needs user-level scan events
-- (entry/exit scans are initiated by the user's own session).
-- We use service_role client in the validate-scan API route so this is
-- covered by the existing service_role policy. No new policy needed if
-- API routes switch to admin client for audit writes.

-- But to be safe, allow users to insert their own scan events:
CREATE POLICY audit_user_scan_insert ON audit_log FOR INSERT
  WITH CHECK (user_id = get_user_id());

-- ─── token_ledger — allow deduction writes from server-side API ──────────────
-- Phase 2 added ledger_user_insert (user_id = get_user_id()).
-- Phase 3 exit deduction runs server-side as the logged-in user — already covered.
-- No new policy needed; existing ledger_user_insert applies.

-- ─── venue_pricing — readable by all authenticated users ─────────────────────
-- Needed to look up peak multipliers at deduction time
CREATE POLICY venue_pricing_read ON venue_pricing FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

-- ─── Helper: get venue tier for a session (used in deduction calc) ───────────
-- This is a DB function to safely compute deduction amount server-side
CREATE OR REPLACE FUNCTION compute_session_deduction(
  p_venue_id UUID,
  p_user_id  UUID,
  p_exit_at  TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier        venue_tier;
  v_base_rate   INTEGER;
  v_multiplier  NUMERIC := 1.0;
  v_discount    NUMERIC := 0.0;
  v_hour        INTEGER;
  v_result      INTEGER;
BEGIN
  -- Get venue tier
  SELECT tier INTO v_tier FROM venues WHERE id = p_venue_id;

  -- Base rates per tier
  v_base_rate := CASE v_tier
    WHEN 'bronze' THEN 6
    WHEN 'silver' THEN 10
    WHEN 'gold'   THEN 16
    ELSE 6
  END;

  -- Peak hours: 6–9am and 5–9pm
  v_hour := EXTRACT(HOUR FROM p_exit_at AT TIME ZONE 'Asia/Kolkata');
  IF (v_hour >= 6 AND v_hour < 9) OR (v_hour >= 17 AND v_hour < 21) THEN
    v_multiplier := 1.5;
  ELSE
    v_multiplier := 1.0;
  END IF;

  -- Check commitment discount
  SELECT COALESCE(cd.discount_rate, 0.0) INTO v_discount
  FROM commitments c
  JOIN commitment_discounts cd ON cd.tier = (SELECT tier FROM venues WHERE id = p_venue_id)
  WHERE c.user_id = p_user_id
    AND c.venue_id = p_venue_id
    AND c.status = 'active'
    AND c.ends_at > p_exit_at
  LIMIT 1;

  -- Clamp multiplier
  v_multiplier := GREATEST(0.6, LEAST(2.0, v_multiplier));

  -- Calculate: ceil(base * multiplier * (1 - discount))
  v_result := CEIL(v_base_rate * v_multiplier * (1.0 - v_discount));

  RETURN v_result;
END;
$$;
