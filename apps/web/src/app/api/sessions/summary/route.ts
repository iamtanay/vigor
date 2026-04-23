import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * GET /api/sessions/summary?sessionId=<id>
 * Returns session summary data for the post-exit screen.
 * Called when the user's active session screen detects the session has been closed.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });

  // Fetch the closed session belonging to this user
  const { data: session } = await supabase
    .from('sessions')
    .select(`
      id, status, entry_scanned_at, exit_scanned_at, auto_closed_at,
      tokens_deducted, venue_id,
      venues!inner(name, tier)
    `)
    .eq('id', sessionId)
    .eq('user_id', profile.id)
    .in('status', ['closed', 'auto_closed'])
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: 'Session not found or still open' }, { status: 404 });
  }

  const venue = session.venues as any;
  const exitAt = session.exit_scanned_at || session.auto_closed_at || new Date().toISOString();
  const entryAt = session.entry_scanned_at || exitAt;
  const durationMins = Math.max(0, Math.round(
    (new Date(exitAt).getTime() - new Date(entryAt).getTime()) / 60000
  ));

  // Calculate IST hour for peak detection
  const exitDate = new Date(exitAt);
  const utcHour = exitDate.getUTCHours();
  const utcMin = exitDate.getUTCMinutes();
  const istHour = (utcHour + 5 + (utcMin >= 30 ? 1 : 0)) % 24;
  const isPeak = (istHour >= 6 && istHour < 9) || (istHour >= 17 && istHour < 21);

  // Fetch current balance
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, ledger_type')
    .eq('user_id', profile.id);

  let balance = 0;
  if (ledger) {
    for (const row of ledger) {
      if (['purchase', 'refund', 'compensation'].includes(row.ledger_type)) {
        balance += row.amount;
      } else {
        balance -= row.amount;
      }
    }
  }

  return NextResponse.json({
    venueName: venue?.name || 'Venue',
    durationMins,
    tokensDeducted: session.tokens_deducted ?? 0,
    isPeak,
    newBalance: Math.max(0, balance),
    entryAt: session.entry_scanned_at,
    exitAt,
    isAutoClose: session.status === 'auto_closed',
  });
}
