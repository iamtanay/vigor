import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import BookingConfirmScreen from './BookingConfirmScreen';

interface Props { params: Promise<{ id: string }> }

export default async function BookingPage({ params }: Props) {
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

  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, status, created_at, entry_qr_expires_at, entry_qr_used, penalty_applied,
      venues!bookings_venue_id_fkey(id, name, tier, address, city),
      venue_slots!bookings_slot_id_fkey(slot_date, start_time, end_time)
    `)
    .eq('id', id)
    .eq('user_id', profile.id)
    .single();

  if (!booking) notFound();

  return <BookingConfirmScreen booking={booking} />;
}
