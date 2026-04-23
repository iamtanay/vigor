import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/sessions/upcoming-bookings
 * Returns confirmed bookings whose slot start is within the next 30 minutes
 * (entry QR window) or hasn't passed yet, sorted by slot start ASC.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ bookings: [] });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ bookings: [] });

  // Get confirmed bookings with upcoming slots (not yet passed entry window)
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000); // 15 min ago (entry window)
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000); // next 24 hrs

  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, status, entry_qr_used,
      venues!inner(name, tier),
      venue_slots!inner(slot_date, start_time, end_time)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'confirmed')
    .eq('entry_qr_used', false)
    .order('created_at', { ascending: true });

  // Filter to upcoming slots in application layer and sort by slot start
  const upcoming = (bookings ?? []).filter((b: any) => {
    const slot = b.venue_slots;
    if (!slot) return false;
    const slotDt = new Date(`${slot.slot_date}T${slot.start_time}+05:30`);
    return slotDt >= windowStart && slotDt <= windowEnd;
  }).sort((a: any, b: any) => {
    const aSlot = new Date(`${a.venue_slots.slot_date}T${a.venue_slots.start_time}+05:30`);
    const bSlot = new Date(`${b.venue_slots.slot_date}T${b.venue_slots.start_time}+05:30`);
    return aSlot.getTime() - bSlot.getTime();
  });

  return NextResponse.json({ bookings: upcoming });
}
