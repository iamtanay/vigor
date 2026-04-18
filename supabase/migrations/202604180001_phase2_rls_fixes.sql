-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2 RLS fixes
-- Policies added here relax P1 constraints that were too restrictive for
-- authenticated Next.js API routes (which run as the logged-in user, not
-- service_role). Service_role-only policies stay for Edge Functions.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── token_ledger ─────────────────────────────────────────────────────────────
-- P1 only allowed service_role to insert. Next.js API routes run as authed
-- user, so we need a separate policy for user-initiated ledger writes
-- (penalty deductions, stub purchases). Edge Functions still use service_role.

CREATE POLICY ledger_user_insert ON token_ledger FOR INSERT
  WITH CHECK (user_id = get_user_id());

-- ─── venue_slots ──────────────────────────────────────────────────────────────
-- Booking flow needs to increment booked_count on the slot. Service role
-- doesn't apply here (no Edge Function yet), so allow service_role update.

CREATE POLICY slots_service_update ON venue_slots FOR UPDATE
  USING (auth.role() = 'service_role');

-- Also allow authenticated users to trigger booked_count changes indirectly
-- via a restricted update: only booked_count column, only increment/decrement.
-- We enforce this in application logic; RLS allows the row access.
CREATE POLICY slots_booking_update ON venue_slots FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

-- ─── bookings ─────────────────────────────────────────────────────────────────
-- P1 bookings_user_cancel only allows status = 'cancelled'.
-- Cancel route also sets penalty_applied = true and cancelled_at.
-- Widen the UPDATE check to allow penalty_applied changes for own bookings.

DROP POLICY IF EXISTS bookings_user_cancel ON bookings;

CREATE POLICY bookings_user_cancel ON bookings FOR UPDATE
  USING (user_id = get_user_id() AND status = 'confirmed')
  WITH CHECK (
    user_id = get_user_id()
    AND status IN ('cancelled')
  );

-- Allow service_role to set no_show status (called from admin/cron)
-- (bookings_service_update already exists from P1 — no change needed)

-- ─── audit_log ────────────────────────────────────────────────────────────────
-- P1 only allows service_role to insert audit_log rows.
-- No-show penalty route (admin-only) needs to write audit entries.
-- Keep service_role-only for normal scan events; add admin bypass.

CREATE POLICY audit_admin_insert ON audit_log FOR INSERT
  WITH CHECK (get_user_role() = 'admin');
