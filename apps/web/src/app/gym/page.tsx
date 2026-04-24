import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GymDashboardClient from './dashboard/GymDashboardClient';

export default async function GymDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/gym/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .single();

  if (!profile || !['gym_owner', 'admin'].includes(profile.role)) {
    redirect('/gym/login');
  }

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, tier, address, opening_time, closing_time, avg_rating, total_ratings, payout_rate_inr')
    .eq('owner_user_id', profile.id)
    .eq('status', 'active')
    .maybeSingle();

  // Server-side seed data for today
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySessions } = venue
    ? await supabase
        .from('sessions')
        .select('id, status, entry_scanned_at, exit_scanned_at, tokens_deducted')
        .eq('venue_id', venue.id)
        .gte('entry_scanned_at', `${today}T00:00:00`)
        .order('entry_scanned_at', { ascending: false })
    : { data: [] };

  return (
    <GymDashboardClient
      profile={profile}
      venue={venue}
      initialSessions={todaySessions ?? []}
    />
  );
}
