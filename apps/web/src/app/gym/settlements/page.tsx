import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GymSettlementsScreen from './GymSettlementsScreen';

export default async function GymSettlementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/gym/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single();

  if (!profile || !['gym_owner', 'admin'].includes(profile.role)) {
    redirect('/gym/login');
  }

  return <GymSettlementsScreen />;
}
