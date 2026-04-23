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
 * POST /api/sessions/generate-exit-qr
 * Body: { sessionId: string }
 * Returns: { qrString: string, issuedAt: string, nextRefreshAt: string }
 *
 * Exit QR is time-windowed — valid for 60 seconds from issuedAt.
 * The QR embeds issuedAt; validate-scan rejects if age > 90s (grace window).
 * No nonce needed — the 60s window makes replay attacks impractical.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Fetch open session belonging to this user
  const { data: session } = await supabase
    .from('sessions')
    .select('id, user_id, venue_id, status, entry_scanned_at')
    .eq('id', sessionId)
    .eq('user_id', profile.id)
    .eq('status', 'open')
    .single();

  if (!session) {
    return NextResponse.json({ error: 'No open session found' }, { status: 404 });
  }

  const secret = process.env.SUPABASE_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev-secret';
  const issuedAt = new Date();

  const payload = {
    type: 'exit' as const,
    session_id: sessionId,
    user_id: profile.id,
    venue_id: session.venue_id,
    issued_at_iso: issuedAt.toISOString(),
  };

  const payloadStr = JSON.stringify(payload);
  const signature = await signPayload(payloadStr, secret);
  const qrString = `vigor:exit:${btoa(payloadStr)}.${signature}`;

  const nextRefreshAt = new Date(issuedAt.getTime() + 60 * 1000);

  return NextResponse.json({
    qrString,
    issuedAt: issuedAt.toISOString(),
    nextRefreshAt: nextRefreshAt.toISOString(),
    sessionId,
    entryScannedAt: session.entry_scanned_at,
  });
}
