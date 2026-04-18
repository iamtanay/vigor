import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, slot_id, venue_id, penalty_applied,
      venue_slots!bookings_slot_id_fkey(slot_date, start_time, booked_count)
    `)
    .eq('id', id)
    .eq('user_id', profile.id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'Booking cannot be cancelled' }, { status: 409 });
  }

  const slot = booking.venue_slots as any;
  const slotDt = new Date(`${slot?.slot_date}T${slot?.start_time}`);
  const hoursUntil = (slotDt.getTime() - Date.now()) / 3600000;
  const isLateCancellation = hoursUntil < 2 && hoursUntil >= 0;

  const { error: updateError } = await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      penalty_applied: isLateCancellation,
    })
    .eq('id', id)
    .eq('user_id', profile.id);

  if (updateError) {
    console.error('Cancel error:', updateError);
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
  }

  if (slot && typeof slot.booked_count === 'number' && slot.booked_count > 0) {
    await supabase
      .from('venue_slots')
      .update({ booked_count: slot.booked_count - 1 })
      .eq('id', booking.slot_id);
  }

  if (isLateCancellation && !booking.penalty_applied) {
    const { data: ledger } = await supabase
      .from('token_ledger').select('amount, expires_at').eq('user_id', profile.id);
    const now = new Date();
    const balance = (ledger ?? []).reduce((sum: number, e: any) => {
      if (!e.expires_at || new Date(e.expires_at) > now) return sum + e.amount;
      return sum;
    }, 0);
    await supabase.from('token_ledger').insert({
      user_id: profile.id,
      booking_id: id,
      type: 'penalty',
      amount: -1,
      balance_after: Math.max(balance - 1, 0),
      notes: 'Late cancellation penalty (< 2 hrs before slot)',
    });
  }

  return NextResponse.json({ cancelled: true, penaltyApplied: isLateCancellation });
}
