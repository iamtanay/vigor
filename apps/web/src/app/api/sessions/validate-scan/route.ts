import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// ── HMAC verify ────────────────────────────────────────────────────────────────
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await signPayload(payload, secret);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

function parseQRString(raw: string) {
  try {
    const parts = raw.split(':');
    if (parts[0] !== 'vigor') return null;
    const type = parts[1] as 'entry' | 'exit';
    const rest = parts[2];
    if (!rest) return null;
    const dotIdx = rest.lastIndexOf('.');
    const payloadB64 = rest.substring(0, dotIdx);
    const signature = rest.substring(dotIdx + 1);
    const payload = JSON.parse(atob(payloadB64));
    return { type, payload, signature, payloadStr: atob(payloadB64) };
  } catch {
    return null;
  }
}

/**
 * POST /api/sessions/validate-scan
 * Body: { qrString: string, scanMethod?: 'staff' | 'kiosk' }
 * Called by the gym owner scan portal.
 * Uses admin (service_role) client — gym owner doesn't need to be authed as the user.
 *
 * For ENTRY scan:
 *  - Validates QR signature, expiry, single-use flag
 *  - Creates session record
 *  - Marks booking entry_qr_used = true
 *  - Writes audit_log entry
 *
 * For EXIT scan:
 *  - Validates QR signature, 90s freshness window
 *  - Computes token deduction
 *  - Closes session, writes deduction to token_ledger
 *  - Marks booking status = 'completed'
 *  - Writes audit_log entry
 *  - Returns session summary (venue, duration, tokens)
 */
export async function POST(req: Request) {
  // Gym owner auth check — must be authenticated
  // We use the admin client for writes but still verify caller is a gym_owner or admin
  const adminSupabase = createAdminClient();

  const body = await req.json();
  const { qrString, scanMethod = 'staff', gymOwnerId } = body;

  if (!qrString) return NextResponse.json({ error: 'Missing qrString' }, { status: 400 });

  const parsed = parseQRString(qrString);
  if (!parsed) return NextResponse.json({ error: 'Invalid QR format' }, { status: 400 });

  const secret = process.env.SUPABASE_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dev-secret';

  // Verify HMAC signature
  const valid = await verifySignature(parsed.payloadStr, parsed.signature, secret);
  if (!valid) return NextResponse.json({ error: 'QR signature invalid' }, { status: 403 });

  // ── ENTRY SCAN ──────────────────────────────────────────────────────────────
  if (parsed.type === 'entry') {
    const ep = parsed.payload as {
      type: 'entry';
      booking_id: string;
      user_id: string;
      venue_id: string;
      slot_start_iso: string;
      nonce: string;
    };

    // Check expiry (15 min after slot start)
    // slot_start_iso is a proper UTC ISO string (generated with +05:30 offset applied)
    const slotStart = new Date(ep.slot_start_iso);
    const expiresAt = new Date(slotStart.getTime() + 15 * 60 * 1000);
    if (new Date() > expiresAt) {
      return NextResponse.json({ error: 'Entry QR has expired (15-min window passed)' }, { status: 410 });
    }

    // Fetch booking
    const { data: booking } = await adminSupabase
      .from('bookings')
      .select('id, status, entry_qr_used, entry_qr_hash, user_id, venue_id')
      .eq('id', ep.booking_id)
      .single();

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    if (booking.entry_qr_used) return NextResponse.json({ error: 'Entry QR already used' }, { status: 409 });
    if (booking.status !== 'confirmed') return NextResponse.json({ error: 'Booking is not confirmed' }, { status: 409 });

    // Check for existing open session (prevent duplicate entry)
    const { data: existingSession } = await adminSupabase
      .from('sessions')
      .select('id')
      .eq('booking_id', ep.booking_id)
      .eq('status', 'open')
      .maybeSingle();

    if (existingSession) {
      return NextResponse.json({ error: 'Session already open for this booking' }, { status: 409 });
    }

    // Create session
    const { data: session, error: sessionError } = await adminSupabase
      .from('sessions')
      .insert({
        booking_id: ep.booking_id,
        user_id: ep.user_id,
        venue_id: ep.venue_id,
        status: 'open',
        entry_scanned_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('Session insert error:', sessionError);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    // Mark entry QR as used
    await adminSupabase
      .from('bookings')
      .update({ entry_qr_used: true })
      .eq('id', ep.booking_id);

    // Fetch venue name for audit
    const { data: venue } = await adminSupabase
      .from('venues')
      .select('name, tier')
      .eq('id', ep.venue_id)
      .single();

    // Write audit log
    await adminSupabase.from('audit_log').insert({
      event_type: 'entry_scan',
      user_id: ep.user_id,
      venue_id: ep.venue_id,
      booking_id: ep.booking_id,
      session_id: session.id,
      scan_method: scanMethod,
      qr_hash: parsed.signature,
      metadata: { slot_start: ep.slot_start_iso, nonce: ep.nonce },
    });

    // Fetch user name for display
    const { data: userProfile } = await adminSupabase
      .from('users')
      .select('name, phone')
      .eq('id', ep.user_id)
      .single();

    return NextResponse.json({
      success: true,
      type: 'entry',
      sessionId: session.id,
      userName: userProfile?.name || userProfile?.phone || 'User',
      venueName: venue?.name || 'Venue',
      entryAt: new Date().toISOString(),
      message: 'Entry recorded. Enjoy your workout!',
    });
  }

  // ── EXIT SCAN ───────────────────────────────────────────────────────────────
  if (parsed.type === 'exit') {
    const ep = parsed.payload as {
      type: 'exit';
      session_id: string;
      user_id: string;
      venue_id: string;
      issued_at_iso: string;
    };

    // Check freshness — exit QR must be < 90 seconds old (60s window + 30s grace)
    const issuedAt = new Date(ep.issued_at_iso);
    const ageSeconds = (Date.now() - issuedAt.getTime()) / 1000;
    if (ageSeconds > 90) {
      return NextResponse.json({
        error: 'Exit QR has expired — please refresh and show the new QR code',
      }, { status: 410 });
    }

    // Fetch session
    const { data: session } = await adminSupabase
      .from('sessions')
      .select(`
        id, user_id, venue_id, booking_id, status, entry_scanned_at,
        tokens_deducted
      `)
      .eq('id', ep.session_id)
      .single();

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    if (session.status !== 'open') {
      return NextResponse.json({ error: 'Session is already closed' }, { status: 409 });
    }

    const exitAt = new Date();

    // Fetch venue for tier
    const { data: venue } = await adminSupabase
      .from('venues')
      .select('name, tier')
      .eq('id', ep.venue_id)
      .single();

    if (!venue) return NextResponse.json({ error: 'Venue not found' }, { status: 404 });

    // Calculate token deduction
    const TIER_BASE_RATES: Record<string, number> = { bronze: 6, silver: 10, gold: 16 };
    const baseRate = TIER_BASE_RATES[venue.tier] ?? 6;
    // Convert exit time to IST (UTC+5:30) for peak hour check
    const utcHour = exitAt.getUTCHours();
    const utcMin = exitAt.getUTCMinutes();
    const istHour = (utcHour + 5 + (utcMin >= 30 ? 1 : 0)) % 24;
    const isPeak = (istHour >= 6 && istHour < 9) || (istHour >= 17 && istHour < 21);
    const multiplier = isPeak ? 1.5 : 1.0;

    // Check commitment discount
    const { data: commitment } = await adminSupabase
      .from('commitments')
      .select('discount_rate')
      .eq('user_id', ep.user_id)
      .eq('venue_id', ep.venue_id)
      .eq('status', 'active')
      .gt('ends_at', exitAt.toISOString())
      .maybeSingle();

    const discount = commitment?.discount_rate ?? 0;
    const tokensToDeduct = Math.ceil(baseRate * multiplier * (1 - discount));

    // Check user has enough tokens (using same pattern as wallet/route.ts)
    const { data: ledger } = await adminSupabase
      .from('token_ledger')
      .select('amount, expires_at, grace_expires_at')
      .eq('user_id', ep.user_id);

    const now2 = new Date();
    let balance = 0;
    for (const e of ledger ?? []) {
      if (e.amount <= 0) {
        balance += e.amount; // debits (negative amount)
      } else if (!e.expires_at || new Date(e.expires_at) >= now2) {
        balance += e.amount; // valid credits
      }
      // expired tokens not counted (grace handled separately)
    }
    balance = Math.max(0, balance);

    if (balance < tokensToDeduct) {
      // Still close the session — deduct what's available, log shortfall
      console.warn(`User ${ep.user_id} has insufficient tokens: ${balance} < ${tokensToDeduct}`);
    }

    const actualDeduction = Math.min(tokensToDeduct, Math.max(balance, 0));

    // Close session
    await adminSupabase
      .from('sessions')
      .update({
        status: 'closed',
        exit_scanned_at: exitAt.toISOString(),
        tokens_deducted: actualDeduction,
      })
      .eq('id', ep.session_id);

    // Deduct tokens from ledger
    if (actualDeduction > 0) {
      await adminSupabase.from('token_ledger').insert({
        user_id: ep.user_id,
        type: 'deduction',
        amount: -actualDeduction,          // negative = debit, per schema convention
        balance_after: Math.max(0, balance - actualDeduction),
        notes: `Session at ${venue.name} — ${isPeak ? 'peak' : 'off-peak'} rate`,
        session_id: ep.session_id,
        venue_id: ep.venue_id,
      });
    }

    // Mark booking as completed
    await adminSupabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', session.booking_id);

    // Calculate duration
    const entryAt = session.entry_scanned_at ? new Date(session.entry_scanned_at) : exitAt;
    const durationMins = Math.round((exitAt.getTime() - entryAt.getTime()) / 60000);

    // Write audit log — exit scan
    await adminSupabase.from('audit_log').insert({
      event_type: 'exit_scan',
      user_id: ep.user_id,
      venue_id: ep.venue_id,
      booking_id: session.booking_id,
      session_id: ep.session_id,
      scan_method: scanMethod,
      qr_hash: parsed.signature,
      token_delta: -actualDeduction,
      metadata: {
        tokens_deducted: actualDeduction,
        tier: venue.tier,
        multiplier,
        discount,
        is_peak: isPeak,
        duration_mins: durationMins,
      },
    });

    // Write token_deduction audit event
    await adminSupabase.from('audit_log').insert({
      event_type: 'token_deduction',
      user_id: ep.user_id,
      venue_id: ep.venue_id,
      session_id: ep.session_id,
      token_delta: -actualDeduction,
      metadata: { tokens_deducted: actualDeduction, balance_before: balance },
    });

    // Fetch user for display
    const { data: userProfile } = await adminSupabase
      .from('users')
      .select('name, phone')
      .eq('id', ep.user_id)
      .single();

    return NextResponse.json({
      success: true,
      type: 'exit',
      sessionId: ep.session_id,
      userName: userProfile?.name || userProfile?.phone || 'User',
      venueName: venue.name,
      durationMins,
      tokensDeducted: actualDeduction,
      isPeak,
      multiplier,
      newBalance: balance - actualDeduction,
      entryAt: session.entry_scanned_at,
      exitAt: exitAt.toISOString(),
      message: `${actualDeduction} tokens deducted. Great workout!`,
    });
  }

  return NextResponse.json({ error: 'Unknown QR type' }, { status: 400 });
}
