import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import HomeScreen from './HomeScreen';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .single();
  if (!profile) redirect('/login');

  // Venues
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, tier, city, address, opening_time, closing_time, avg_rating, amenities, activity_types')
    .eq('status', 'active')
    .order('avg_rating', { ascending: false })
    .limit(4);

  // Token balance — correct: use 'type' column (not 'ledger_type')
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, type, expires_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  const now = new Date();
  let balance = 0;
  let earliestExpiry: string | null = null;

  for (const row of ledger ?? []) {
    if (row.amount > 0) {
      // Credit — check expiry
      if (!row.expires_at || new Date(row.expires_at) >= now) {
        balance += row.amount;
        if (row.expires_at && (!earliestExpiry || row.expires_at < earliestExpiry)) {
          earliestExpiry = row.expires_at;
        }
      }
      // expired credits not counted (grace handled separately in wallet)
    } else {
      balance += row.amount; // negative debit
    }
  }

  // Next upcoming booking
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id, status,
      venues!inner(name, tier),
      venue_slots!inner(slot_date, start_time, end_time)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'confirmed')
    .order('created_at', { ascending: true })
    .limit(10);

  const upcomingBooking = (bookings ?? []).find((b: any) => {
    const slot = b.venue_slots;
    if (!slot) return false;
    return new Date(`${slot.slot_date}T${slot.start_time}+05:30`) >= now;
  }) ?? null;

  // Active session
  const { data: activeSession } = await supabase
    .from('sessions')
    .select('id, status, entry_scanned_at, venues!inner(name, tier)')
    .eq('user_id', profile.id)
    .eq('status', 'open')
    .maybeSingle();

  return (
    <HomeScreen
      user={profile}
      venues={venues ?? []}
      tokenBalance={Math.max(0, balance)}
      tokenExpiry={earliestExpiry}
      upcomingBooking={upcomingBooking}
      activeSession={activeSession}
    />
  );
}
