import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import HomeScreen from './HomeScreen';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Fetch user profile
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .single();

  if (!profile) redirect('/login');

  // Fetch token balance (sum of positive ledger entries minus deductions)
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, expires_at, grace_expires_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: true });

  let availableTokens = 0;
  let earliestExpiry: string | null = null;
  const now = new Date();

  if (ledger) {
    for (const entry of ledger) {
      if (entry.expires_at && new Date(entry.expires_at) < now) {
        // Check grace period
        if (entry.grace_expires_at && new Date(entry.grace_expires_at) > now && entry.amount > 0) {
          availableTokens += Math.floor(entry.amount * 0.5);
        }
        // else lapsed
      } else {
        availableTokens += entry.amount;
      }
      if (entry.amount > 0 && entry.expires_at) {
        if (!earliestExpiry || entry.expires_at < earliestExpiry) {
          earliestExpiry = entry.expires_at;
        }
      }
    }
  }

  // Fetch active venues
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, tier, city, address, latitude, longitude, amenities, activity_types, avg_rating, total_ratings, opening_time, closing_time, image_urls')
    .eq('status', 'active')
    .limit(10);

  // Fetch today's upcoming bookings
  const today = new Date().toISOString().split('T')[0];
  const { data: upcomingBookings } = await supabase
    .from('bookings')
    .select(`
      id, status, created_at,
      venues!bookings_venue_id_fkey(id, name, tier, address),
      venue_slots!bookings_slot_id_fkey(slot_date, start_time, end_time)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'confirmed')
    .gte('venue_slots.slot_date', today)
    .order('created_at', { ascending: false })
    .limit(3);

  return (
    <HomeScreen
      userName={profile.name ?? 'there'}
      tokenBalance={availableTokens}
      earliestExpiry={earliestExpiry}
      venues={venues ?? []}
      upcomingBookings={upcomingBookings ?? []}
      userId={profile.id}
    />
  );
}
