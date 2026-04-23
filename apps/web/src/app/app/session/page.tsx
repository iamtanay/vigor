import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ActiveSessionScreen from './ActiveSessionScreen';

interface PageProps {
  searchParams: Promise<{ bookingId?: string }>;
}

export default async function ActiveSessionPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .single();

  if (!profile) redirect('/login');

  const params = await searchParams;
  const bookingIdFromUrl = params?.bookingId ?? null;

  // Use left joins (no !inner) to avoid RLS errors when no session/booking exists.
  // !inner causes Supabase to return null for the whole row if the joined table
  // has no matching row — and a failed join can trigger an internal token refresh
  // attempt that corrupts cookie state in server component renders.
  const { data: rawSession } = await supabase
    .from('sessions')
    .select(`
      id, status, entry_scanned_at, venue_id,
      venues(name, tier, address),
      bookings(
        id,
        venue_slots(slot_date, start_time, end_time)
      )
    `)
    .eq('user_id', profile.id)
    .eq('status', 'open')
    .order('entry_scanned_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Normalise: bookings is a left-join array, take first element
  let initialSession = null;
  if (rawSession) {
    const venues = rawSession.venues as any;
    const bookingArr = rawSession.bookings as any;
    const booking = Array.isArray(bookingArr) ? bookingArr[0] : bookingArr;

    // Only pass session down if venues joined successfully
    if (venues?.name) {
      initialSession = {
        id: rawSession.id,
        status: rawSession.status,
        entry_scanned_at: rawSession.entry_scanned_at,
        venue_id: rawSession.venue_id,
        venues: {
          name: venues.name,
          tier: venues.tier ?? 'bronze',
          address: venues.address ?? '',
        },
        bookings: booking ?? null,
      };
    }
  }

  return (
    <ActiveSessionScreen
      initialSession={initialSession}
      userId={profile.id}
      initialBookingId={bookingIdFromUrl}
    />
  );
}
