import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import GymScanPortal from './GymScanPortal';

export default async function GymScanPage() {
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

  // Get venue for this owner
  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, tier')
    .eq('owner_user_id', profile.id)
    .eq('status', 'active')
    .maybeSingle();

  return <GymScanPortal ownerName={profile.name || 'Owner'} venue={venue} />;
}
