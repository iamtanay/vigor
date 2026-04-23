import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/sessions/active
 * Returns the user's current open session (if any).
 *
 * NOTE: Auto-close is intentionally NOT triggered here.
 * Triggering a server-to-server fetch() from inside a Route Handler
 * that is itself called from a client component causes the internal
 * request to run without auth cookies, which can fail silently and
 * corrupt the response stream — breaking cookie state for subsequent
 * server-component renders (wallet shows 0, tokens reset, etc).
 *
 * Auto-close is instead triggered by:
 *  1. The Vercel cron job (vercel.json) every 15 min in production
 *  2. Manually: POST /api/sessions/auto-close from the gym scan portal
 *  3. The lazy trigger in /api/sessions/generate-exit-qr (safe because
 *     that route already holds the auth context)
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ session: null });

  // Left join on bookings (no !inner) so a missing booking never silently
  // returns null for the whole row or triggers an unexpected RLS error
  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      id, status, entry_scanned_at, tokens_deducted,
      venue_id,
      venues!inner(name, tier, address),
      bookings(
        id, slot_id,
        venue_slots(slot_date, start_time, end_time)
      )
    `)
    .eq('user_id', profile.id)
    .eq('status', 'open')
    .order('entry_scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('active session fetch error:', error.message);
    return NextResponse.json({ session: null });
  }

  if (!session) {
    return NextResponse.json({ session: null });
  }

  const venue = session.venues as any;
  const bookingArr = session.bookings as any;
  const booking = Array.isArray(bookingArr) ? bookingArr[0] : bookingArr;
  const slot = booking?.venue_slots;

  const entryAt = session.entry_scanned_at ? new Date(session.entry_scanned_at) : new Date();
  const durationMins = Math.round((Date.now() - entryAt.getTime()) / 60000);
  const autoCloseWarning = durationMins > 210;

  return NextResponse.json({
    session: {
      id: session.id,
      venueId: session.venue_id,
      venueName: venue.name,
      venueAddress: venue.address,
      venueTier: venue.tier,
      entryScannedAt: session.entry_scanned_at,
      durationMins,
      autoCloseWarning,
      bookingId: booking?.id ?? null,
      slotDate: slot?.slot_date ?? null,
      slotStart: slot?.start_time ?? null,
      slotEnd: slot?.end_time ?? null,
    },
  });
}
