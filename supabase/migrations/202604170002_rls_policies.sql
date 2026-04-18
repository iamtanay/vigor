-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE venue_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role from users table
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper: get current user's DB id
CREATE OR REPLACE FUNCTION get_user_id()
RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ─── users ───────────────────────────────────────────────────────────────────

-- Users can read and update their own record
CREATE POLICY users_select_own ON users FOR SELECT
  USING (auth_id = auth.uid() OR get_user_role() IN ('admin'));

CREATE POLICY users_update_own ON users FOR UPDATE
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid() AND role = 'user'); -- can't self-promote role

CREATE POLICY users_admin_all ON users FOR ALL
  USING (get_user_role() = 'admin');

-- ─── venues ──────────────────────────────────────────────────────────────────

-- All active venues are publicly readable (for discovery)
CREATE POLICY venues_public_read ON venues FOR SELECT
  USING (status = 'active' OR get_user_role() IN ('admin', 'gym_owner'));

-- Gym owners can update their own venue
CREATE POLICY venues_owner_update ON venues FOR UPDATE
  USING (owner_user_id = get_user_id() AND get_user_role() = 'gym_owner')
  WITH CHECK (
    owner_user_id = get_user_id()
    AND tier = (SELECT tier FROM venues WHERE id = venues.id) -- can't change own tier
  );

CREATE POLICY venues_admin_all ON venues FOR ALL
  USING (get_user_role() = 'admin');

-- ─── venue_slots ──────────────────────────────────────────────────────────────

CREATE POLICY slots_public_read ON venue_slots FOR SELECT
  USING (TRUE); -- anyone can read slot availability

CREATE POLICY slots_owner_write ON venue_slots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM venues v
      WHERE v.id = venue_id AND v.owner_user_id = get_user_id()
    )
  );

CREATE POLICY slots_admin_all ON venue_slots FOR ALL
  USING (get_user_role() = 'admin');

-- ─── token_bundles ────────────────────────────────────────────────────────────

CREATE POLICY bundles_public_read ON token_bundles FOR SELECT
  USING (is_active = TRUE OR get_user_role() = 'admin');

CREATE POLICY bundles_admin_write ON token_bundles FOR ALL
  USING (get_user_role() = 'admin');

-- ─── token_ledger ─────────────────────────────────────────────────────────────

CREATE POLICY ledger_user_read ON token_ledger FOR SELECT
  USING (user_id = get_user_id() OR get_user_role() = 'admin');

-- Only service_role can insert (via Edge Functions)
CREATE POLICY ledger_service_insert ON token_ledger FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── bookings ─────────────────────────────────────────────────────────────────

CREATE POLICY bookings_user_own ON bookings FOR SELECT
  USING (user_id = get_user_id() OR guest_user_id = get_user_id());

CREATE POLICY bookings_user_insert ON bookings FOR INSERT
  WITH CHECK (user_id = get_user_id());

CREATE POLICY bookings_user_cancel ON bookings FOR UPDATE
  USING (user_id = get_user_id() AND status = 'confirmed')
  WITH CHECK (status = 'cancelled');

CREATE POLICY bookings_gym_read ON bookings FOR SELECT
  USING (
    get_user_role() = 'gym_owner' AND
    EXISTS (
      SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = get_user_id()
    )
  );

CREATE POLICY bookings_admin_all ON bookings FOR ALL
  USING (get_user_role() = 'admin');

-- Service role for QR operations
CREATE POLICY bookings_service_update ON bookings FOR UPDATE
  USING (auth.role() = 'service_role');

-- ─── sessions ─────────────────────────────────────────────────────────────────

CREATE POLICY sessions_user_own ON sessions FOR SELECT
  USING (user_id = get_user_id());

CREATE POLICY sessions_gym_read ON sessions FOR SELECT
  USING (
    get_user_role() = 'gym_owner' AND
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = get_user_id())
  );

CREATE POLICY sessions_admin_all ON sessions FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY sessions_service_all ON sessions FOR ALL
  USING (auth.role() = 'service_role');

-- ─── audit_log ────────────────────────────────────────────────────────────────

-- Users can only read their own entries
CREATE POLICY audit_user_own ON audit_log FOR SELECT
  USING (user_id = get_user_id());

CREATE POLICY audit_gym_own ON audit_log FOR SELECT
  USING (
    get_user_role() = 'gym_owner' AND
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = get_user_id())
  );

CREATE POLICY audit_admin_all ON audit_log FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY audit_service_insert ON audit_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ─── settlements ──────────────────────────────────────────────────────────────

CREATE POLICY settlements_gym_read ON settlements FOR SELECT
  USING (
    get_user_role() = 'gym_owner' AND
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = get_user_id())
  );

CREATE POLICY settlements_admin_all ON settlements FOR ALL
  USING (get_user_role() = 'admin');

-- ─── ratings ─────────────────────────────────────────────────────────────────

CREATE POLICY ratings_public_read ON ratings FOR SELECT USING (TRUE);

CREATE POLICY ratings_user_insert ON ratings FOR INSERT
  WITH CHECK (user_id = get_user_id());

CREATE POLICY ratings_admin_all ON ratings FOR ALL
  USING (get_user_role() = 'admin');

-- ─── commitments ──────────────────────────────────────────────────────────────

CREATE POLICY commitments_user_own ON commitments FOR SELECT
  USING (user_id = get_user_id());

CREATE POLICY commitments_user_insert ON commitments FOR INSERT
  WITH CHECK (user_id = get_user_id());

CREATE POLICY commitments_admin_all ON commitments FOR ALL
  USING (get_user_role() = 'admin');

-- ─── kiosk_devices ────────────────────────────────────────────────────────────

CREATE POLICY kiosk_gym_read ON kiosk_devices FOR SELECT
  USING (
    get_user_role() = 'gym_owner' AND
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = get_user_id())
  );

CREATE POLICY kiosk_admin_all ON kiosk_devices FOR ALL
  USING (get_user_role() = 'admin');

CREATE POLICY kiosk_service_all ON kiosk_devices FOR ALL
  USING (auth.role() = 'service_role');

-- ─── venue_pricing ────────────────────────────────────────────────────────────

CREATE POLICY pricing_public_read ON venue_pricing FOR SELECT USING (is_active = TRUE);

CREATE POLICY pricing_gym_write ON venue_pricing FOR ALL
  USING (
    get_user_role() = 'gym_owner' AND
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = get_user_id())
  );

CREATE POLICY pricing_admin_all ON venue_pricing FOR ALL
  USING (get_user_role() = 'admin');

-- ─── admin_actions ────────────────────────────────────────────────────────────

CREATE POLICY admin_actions_admin_all ON admin_actions FOR ALL
  USING (get_user_role() = 'admin');