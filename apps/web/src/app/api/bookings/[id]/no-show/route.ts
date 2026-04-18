import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * POST /api/bookings/[id]/no-show
 * Marks a booking as no_show and deducts 1-token penalty.
 * In production this is called by a scheduled cron job via service role.
 * For now it can also be called manually by admin for testing.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Only admin can trigger this (or service role from cron)
  if (profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select(`id, status, user_id, slot_id, penalty_applied,
      venue_slots!bookings_slot_id_fkey(slot_date, start_time)`)
    .eq('id', id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status !== 'confirmed') return NextResponse.json({ error: 'Booking is not confirmed' }, { status: 409 });
  if (booking.penalty_applied) return NextResponse.json({ error: 'Penalty already applied' }, { status: 409 });

  // Update booking
  await supabase.from('bookings').update({
    status: 'no_show',
    penalty_applied: true,
  }).eq('id', id);

  // Deduct 1 token
  const { data: ledger } = await supabase
    .from('token_ledger').select('amount').eq('user_id', booking.user_id);
  const balance = (ledger ?? []).reduce((s: number, e: any) => s + e.amount, 0);

  await supabase.from('token_ledger').insert({
    user_id: booking.user_id,
    booking_id: id,
    type: 'penalty',
    amount: -1,
    balance_after: balance - 1,
    notes: 'No-show penalty',
  });

  // Write to audit log
  await supabase.from('audit_log').insert({
    event_type: 'no_show_penalty',
    user_id: booking.user_id,
    booking_id: id,
    token_amount: -1,
    metadata: { triggered_by: profile.id },
  });

  return NextResponse.json({ success: true, penaltyDeducted: 1 });
}
