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

  // Token balance + earliest expiry
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, ledger_type, expires_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false });

  let balance = 0;
  let earliestExpiry: string | null = null;
  for (const row of ledger ?? []) {
    if (['purchase', 'refund', 'compensation'].includes(row.ledger_type)) {
      balance += row.amount;
      if (row.expires_at && (!earliestExpiry || row.expires_at < earliestExpiry)) {
        earliestExpiry = row.expires_at;
      }
    } else {
      balance -= row.amount;
    }
  }

  // Next upcoming booking
  const now = new Date();
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
    .limit(5);

  const upcomingBooking = (bookings ?? []).find((b: any) => {
    const slot = b.venue_slots;
    if (!slot) return false;
    return new Date(`${slot.slot_date}T${slot.start_time}`) >= now;
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
