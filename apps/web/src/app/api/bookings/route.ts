import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { slotId, venueId, guestUserId } = await req.json();
  if (!slotId || !venueId) return NextResponse.json({ error: 'Missing slotId or venueId' }, { status: 400 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data: slot } = await supabase
    .from('venue_slots')
    .select('id, venue_id, capacity, booked_count, is_blocked, slot_date, start_time')
    .eq('id', slotId)
    .eq('venue_id', venueId)
    .single();

  if (!slot) return NextResponse.json({ error: 'Slot not found' }, { status: 404 });
  if (slot.is_blocked) return NextResponse.json({ error: 'Slot is blocked' }, { status: 409 });
  if (slot.booked_count >= slot.capacity) return NextResponse.json({ error: 'Slot is full' }, { status: 409 });

  // Only reject slots that have already passed — no upper advance limit
  const slotDt = new Date(`${slot.slot_date}T${slot.start_time}`);
  if (slotDt.getTime() < Date.now() - 15 * 60 * 1000) {
    return NextResponse.json({ error: 'This slot has already passed' }, { status: 409 });
  }

  // Duplicate check
  const { data: existing } = await supabase
    .from('bookings')
    .select('id')
    .eq('user_id', profile.id)
    .eq('slot_id', slotId)
    .eq('status', 'confirmed')
    .maybeSingle();
  if (existing) return NextResponse.json({ error: 'You already have this slot booked' }, { status: 409 });

  if (guestUserId) {
    const { data: guest } = await supabase.from('users').select('id').eq('id', guestUserId).single();
    if (!guest) return NextResponse.json({ error: 'Guest user not found' }, { status: 404 });
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      user_id: profile.id,
      venue_id: venueId,
      slot_id: slotId,
      status: 'confirmed',
      guest_user_id: guestUserId ?? null,
      penalty_applied: false,
      entry_qr_used: false,
    })
    .select('id')
    .single();

  if (bookingError) {
    console.error('Booking insert error:', bookingError);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }

  await supabase
    .from('venue_slots')
    .update({ booked_count: slot.booked_count + 1 })
    .eq('id', slotId);

  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
