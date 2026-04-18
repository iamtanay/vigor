import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import VenueDetailScreen from './VenueDetailScreen';

interface Props { params: Promise<{ id: string }> }

export default async function VenuePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single();
  if (!profile) redirect('/login');

  const { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('id', id)
    .eq('status', 'active')
    .single();

  if (!venue) notFound();

  // Fetch slots for next 3 days
  const today = new Date().toISOString().split('T')[0];
  const threeDays = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  const { data: slots } = await supabase
    .from('venue_slots')
    .select('*')
    .eq('venue_id', id)
    .gte('slot_date', today)
    .lte('slot_date', threeDays)
    .eq('is_blocked', false)
    .order('slot_date', { ascending: true })
    .order('start_time', { ascending: true });

  // Check if user has active commitment for this venue
  const { data: commitment } = await supabase
    .from('commitments')
    .select('id, discount_rate, duration, ends_at')
    .eq('user_id', profile.id)
    .eq('venue_id', id)
    .eq('status', 'active')
    .single();

  // Fetch recent ratings
  const { data: ratings } = await supabase
    .from('ratings')
    .select('score, note, created_at, users!ratings_user_id_fkey(name)')
    .eq('venue_id', id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Token balance
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, expires_at')
    .eq('user_id', profile.id);

  let tokenBalance = 0;
  const now = new Date();
  for (const e of ledger ?? []) {
    if (!e.expires_at || new Date(e.expires_at) > now) {
      tokenBalance += e.amount;
    }
  }

  return (
    <VenueDetailScreen
      venue={venue}
      slots={slots ?? []}
      commitment={commitment}
      ratings={ratings ?? []}
      tokenBalance={tokenBalance}
      userId={profile.id}
    />
  );
}
