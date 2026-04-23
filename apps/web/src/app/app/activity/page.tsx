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

  // Fetch sessions history (closed + auto_closed)
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

  // All confirmed upcoming bookings (not just entry-window ones)
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
    .limit(20);

  // Filter to future-ish slots (not passed more than 15 min ago)
  const now = new Date();
  const upcoming = (upcomingBookings ?? []).filter((b: any) => {
    const slot = b.venue_slots;
    if (!slot) return false;
    const slotDt = new Date(`${slot.slot_date}T${slot.start_time}+05:30`);
    return slotDt >= new Date(now.getTime() - 15 * 60 * 1000);
  });

  // Active session check
  const { data: activeSession } = await supabase
    .from('sessions')
    .select(`id, status, entry_scanned_at, venues!inner(name, tier)`)
    .eq('user_id', profile.id)
    .eq('status', 'open')
    .maybeSingle();

  // Token balance — correct calculation using 'type' column
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, type, expires_at')
    .eq('user_id', profile.id);

  let balance = 0;
  const nowTs = new Date();
  for (const row of ledger ?? []) {
    if (row.amount > 0) {
      // Only count non-expired credits
      if (!row.expires_at || new Date(row.expires_at) >= nowTs) {
        balance += row.amount;
      }
    } else {
      balance += row.amount; // negative debit
    }
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
