import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ActivityScreen from './ActivityScreen';

export default async function ActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .single();
  if (!profile) redirect('/login');

  // Fetch sessions with venue and booking info
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, status, entry_scanned_at, exit_scanned_at, auto_closed_at, tokens_deducted, created_at,
      venues!sessions_venue_id_fkey(id, name, tier, city),
      bookings!sessions_booking_id_fkey(
        id, status,
        venue_slots!bookings_slot_id_fkey(slot_date, start_time, end_time)
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(30);

  // Fetch upcoming confirmed bookings (no session yet)
  const today = new Date().toISOString().split('T')[0];
  const { data: upcoming } = await supabase
    .from('bookings')
    .select(`
      id, status, created_at,
      venues!bookings_venue_id_fkey(id, name, tier, city),
      venue_slots!bookings_slot_id_fkey(slot_date, start_time, end_time)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'confirmed')
    .gte('venue_slots.slot_date', today)
    .order('created_at', { ascending: false })
    .limit(10);

  // Token balance for header
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, expires_at')
    .eq('user_id', profile.id);

  const now = new Date();
  const tokenBalance = (ledger ?? []).reduce((sum: number, e: any) => {
    if (!e.expires_at || new Date(e.expires_at) > now) return sum + e.amount;
    return sum;
  }, 0);

  return (
    <ActivityScreen
      sessions={sessions ?? []}
      upcomingBookings={upcoming ?? []}
      tokenBalance={Math.max(tokenBalance, 0)}
    />
  );
}
