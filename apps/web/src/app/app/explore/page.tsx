import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ExploreScreen from './ExploreScreen';

export default async function ExplorePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();
  if (!profile) redirect('/login');

  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, tier, city, address, latitude, longitude, amenities, activity_types, avg_rating, total_ratings, opening_time, closing_time, image_urls, description')
    .eq('status', 'active')
    .order('avg_rating', { ascending: false });

  // Token balance for header chip
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, expires_at')
    .eq('user_id', profile.id);

  const now = new Date();
  const tokenBalance = (ledger ?? []).reduce((sum: number, e: any) => {
    if (!e.expires_at || new Date(e.expires_at) > now) return sum + e.amount;
    return sum;
  }, 0);

  return <ExploreScreen venues={venues ?? []} tokenBalance={tokenBalance} />;
}
