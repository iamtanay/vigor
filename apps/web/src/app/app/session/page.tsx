import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ActiveSessionScreen from './ActiveSessionScreen';

export default async function ActiveSessionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .single();

  if (!profile) redirect('/login');

  // Fetch active session
  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, status, entry_scanned_at,
      venue_id,
      venues!inner(name, tier, address),
      bookings!inner(
        id,
        venue_slots!inner(slot_date, start_time, end_time)
      )
    `)
    .eq('user_id', profile.id)
    .eq('status', 'open')
    .order('entry_scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return <ActiveSessionScreen initialSession={session} userId={profile.id} />;
}
