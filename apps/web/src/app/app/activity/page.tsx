import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ActivityScreen from './ActivityScreen';

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();

  if (!profile) redirect('/login');

  // Fetch sessions (history)
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, status, entry_scanned_at, exit_scanned_at, auto_closed_at, tokens_deducted,
      venues!inner(name, tier),
      bookings!inner(
        id,
        venue_slots!inner(slot_date, start_time, end_time)
      )
    `)
    .eq('user_id', profile.id)
    .in('status', ['closed', 'auto_closed'])
    .order('entry_scanned_at', { ascending: false })
    .limit(20);

  // Upcoming bookings
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select(`
      id, status, entry_qr_used,
      venues!inner(name, tier),
      venue_slots!inner(slot_date, start_time, end_time)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true })
    .limit(10);

  // Filter to future slots
  const now = new Date();
  const upcoming = (upcomingBookings ?? []).filter((b: any) => {
    const slot = b.venue_slots;
    if (!slot) return false;
    const slotDt = new Date(`${slot.slot_date}T${slot.start_time}+05:30`);
    return slotDt >= new Date(now.getTime() - 15 * 60 * 1000);
  });

  // Active session
  const { data: activeSession } = await supabase
    .from('sessions')
    .select(`id, status, entry_scanned_at, venues!inner(name, tier)`)
    .eq('user_id', profile.id)
    .eq('status', 'open')
    .maybeSingle();

  // Token balance
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, ledger_type')
    .eq('user_id', profile.id);

  let balance = 0;
  for (const row of ledger ?? []) {
    if (['purchase', 'refund', 'compensation'].includes(row.ledger_type)) balance += row.amount;
    else balance -= row.amount;
  }

  return (
    <ActivityScreen
      sessions={sessions ?? []}
      upcomingBookings={upcoming}
      tokenBalance={Math.max(0, balance)}
      activeSession={activeSession}
    />
  );
}
