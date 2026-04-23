import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/sessions/upcoming-bookings
 * Returns all confirmed upcoming bookings for the user.
 * Used by the Session tab to show entry QR options.
 *
 * Returns bookings sorted by slot start ASC.
 * Includes a `inEntryWindow` flag for the 15-min-before-slot window.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ bookings: [] });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ bookings: [] });

  // Get ALL confirmed bookings where entry QR hasn't been used yet
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, status, entry_qr_used, created_at,
      venues!inner(name, tier),
      venue_slots!inner(slot_date, start_time, end_time)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'confirmed')
    .eq('entry_qr_used', false)
    .order('created_at', { ascending: true });

  const now = new Date();
  // 15 min entry window: show QR starting 30 min before slot to well after slot start
  const entryWindowStart = new Date(now.getTime() - 15 * 60 * 1000); // 15 min ago

  // Filter out slots that have already expired (more than 15 min past start)
  const upcoming = (bookings ?? [])
    .filter((b: any) => {
      const slot = b.venue_slots;
      if (!slot) return false;
      const slotDt = new Date(`${slot.slot_date}T${slot.start_time}+05:30`);
      // Keep if slot start is in the future OR within the 15-min entry grace
      return slotDt >= entryWindowStart;
    })
    .map((b: any) => {
      const slot = b.venue_slots;
      const slotDt = new Date(`${slot.slot_date}T${slot.start_time}+05:30`);
      const slotEndDt = new Date(slotDt.getTime() + 60 * 60 * 1000); // assume 1h if no end
      // Entry window: from 30 min before slot until 15 min after slot start
      const windowOpen = new Date(slotDt.getTime() - 30 * 60 * 1000);
      const windowClose = new Date(slotDt.getTime() + 15 * 60 * 1000);
      const inEntryWindow = now >= windowOpen && now <= windowClose;
      const minutesUntil = Math.round((slotDt.getTime() - now.getTime()) / 60000);
      return { ...b, inEntryWindow, minutesUntil };
    })
    .sort((a: any, b: any) => {
      const aSlot = new Date(`${a.venue_slots.slot_date}T${a.venue_slots.start_time}+05:30`);
      const bSlot = new Date(`${b.venue_slots.slot_date}T${b.venue_slots.start_time}+05:30`);
      return aSlot.getTime() - bSlot.getTime();
    });

  return NextResponse.json({ bookings: upcoming });
}
