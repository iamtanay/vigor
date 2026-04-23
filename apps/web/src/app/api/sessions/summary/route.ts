import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/sessions/summary?sessionId=<uuid>
 * Returns summary data for a closed session (for the post-exit summary screen).
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // Fetch the closed session for this user
  const { data: session, error } = await supabase
    .from('sessions')
    .select(`
      id, status, entry_scanned_at, exit_scanned_at, auto_closed_at,
      tokens_deducted, peak_multiplier_used, commitment_discount,
      venue_id,
      venues!inner(name, tier)
    `)
    .eq('id', sessionId)
    .eq('user_id', profile.id)
    .in('status', ['closed', 'auto_closed'])
    .single();

  if (error || !session) {
    // Session not found or still open — return null (client handles gracefully)
    return NextResponse.json({ summary: null }, { status: 404 });
  }

  const venue = session.venues as any;
  const entryAt = session.entry_scanned_at ? new Date(session.entry_scanned_at) : null;
  const exitAt = session.exit_scanned_at
    ? new Date(session.exit_scanned_at)
    : session.auto_closed_at
    ? new Date(session.auto_closed_at)
    : new Date();

  const durationMins = entryAt
    ? Math.max(1, Math.round((exitAt.getTime() - entryAt.getTime()) / 60000))
    : 0;

  // Determine peak from stored multiplier
  const multiplier = session.peak_multiplier_used ?? 1.0;
  const isPeak = Number(multiplier) > 1.0;

  // Fetch current balance for display
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, expires_at')
    .eq('user_id', profile.id);

  const nowTs = new Date();
  let balance = 0;
  for (const e of ledger ?? []) {
    if (e.amount > 0) {
      if (!e.expires_at || new Date(e.expires_at) >= nowTs) balance += e.amount;
    } else {
      balance += e.amount;
    }
  }

  return NextResponse.json({
    venueName: venue.name,
    venueTier: venue.tier,
    durationMins,
    tokensDeducted: session.tokens_deducted ?? 0,
    isPeak,
    multiplier,
    newBalance: Math.max(0, balance),
    entryAt: session.entry_scanned_at,
    exitAt: exitAt.toISOString(),
    isAutoClosed: session.status === 'auto_closed',
  });
}
