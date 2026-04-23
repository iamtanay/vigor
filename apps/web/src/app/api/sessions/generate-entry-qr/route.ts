import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * POST /api/sessions/generate-entry-qr
 * Body: { bookingId: string }
 * Returns: { qrString: string, expiresAt: string, venueName: string, slotStart: string }
 *
 * Generates a single-use HMAC-signed entry QR for a confirmed booking.
 * QR expires 15 minutes after slot start time.
 *
 * NOTE: The QR can be generated at ANY time before the slot — the expiry is
 * enforced at scan time by validate-scan (must scan within 15 min of slot start).
 * This allows users to see their QR ahead of time.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { bookingId } = await req.json();
  if (!bookingId) return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Fetch booking with slot and venue
  const { data: booking } = await supabase
    .from('bookings')
    .select(`
      id, user_id, venue_id, status, entry_qr_used,
      venue_slots!inner(slot_date, start_time),
      venues!inner(id, name, tier)
    `)
    .eq('id', bookingId)
    .eq('user_id', profile.id)
    .single();

  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'Booking is not in confirmed state' }, { status: 409 });
  }
  if (booking.entry_qr_used) {
    return NextResponse.json({ error: 'Entry QR already used — session already started' }, { status: 409 });
  }

  const slot = booking.venue_slots as any;
  // Interpret slot_date + start_time as IST (UTC+5:30)
  const slotDateTimeIST = `${slot.slot_date}T${slot.start_time}+05:30`;
  const slotStart = new Date(slotDateTimeIST);

  // QR expires 15 min after slot start (enforced at scan time)
  const expiresAt = new Date(slotStart.getTime() + 15 * 60 * 1000);

  // Check if entry window has already closed
  if (expiresAt < new Date()) {
    return NextResponse.json({ error: 'Entry window has expired for this slot' }, { status: 410 });
  }

  const secret = process.env.SUPABASE_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev-secret';
  const nonce = crypto.randomUUID();

  const payload = {
    type: 'entry' as const,
    booking_id: bookingId,
    user_id: profile.id,
    venue_id: booking.venue_id,
    slot_start_iso: slotStart.toISOString(),
    nonce,
  };

  const payloadStr = JSON.stringify(payload);
  const signature = await signPayload(payloadStr, secret);
  const qrString = `vigor:entry:${btoa(payloadStr)}.${signature}`;

  // Store hash on booking (overwrites any previous hash — last generated wins)
  await supabase
    .from('bookings')
    .update({
      entry_qr_hash: signature,
      entry_qr_expires_at: expiresAt.toISOString(),
    })
    .eq('id', bookingId);

  const minutesUntilSlot = Math.round((slotStart.getTime() - Date.now()) / 60000);

  return NextResponse.json({
    qrString,
    expiresAt: expiresAt.toISOString(),
    venueName: (booking.venues as any).name,
    slotStart: slotStart.toISOString(),
    minutesUntilSlot,
    // If slot is in the future, the QR won't be scannable yet (validate-scan checks expiry)
    scanWindowNote: minutesUntilSlot > 15
      ? `QR becomes scannable ${minutesUntilSlot - 0} min before slot`
      : 'QR is ready to scan',
  });
}
