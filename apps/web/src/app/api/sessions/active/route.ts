import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/sessions/active
 * Returns the user's current open session (if any).
 * Also triggers auto-close check in the background.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ session: null });

  // Trigger auto-close in background (fire and forget — don't await)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  fetch(`${baseUrl}/api/sessions/auto-close`, { method: 'POST' }).catch(() => {});

  // Fetch open session
  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, status, entry_scanned_at, tokens_deducted,
      venue_id,
      venues!inner(name, tier, address),
      bookings!inner(
        id, slot_id,
        venue_slots!inner(slot_date, start_time, end_time)
      )
    `)
    .eq('user_id', profile.id)
    .eq('status', 'open')
    .order('entry_scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ session: null });
  }

  const venue = session.venues as any;
  const booking = session.bookings as any;
  const slot = booking?.venue_slots;

  // Check if auto-close threshold exceeded (client can show warning)
  const entryAt = session.entry_scanned_at ? new Date(session.entry_scanned_at) : new Date();
  const durationMins = Math.round((Date.now() - entryAt.getTime()) / 60000);
  const autoCloseWarning = durationMins > 210; // warn at 3.5 hrs

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
      bookingId: booking?.id,
      slotDate: slot?.slot_date,
      slotStart: slot?.start_time,
      slotEnd: slot?.end_time,
    },
  });
}
