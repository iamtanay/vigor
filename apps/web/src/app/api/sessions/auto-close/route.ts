import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/sessions/auto-close
 *
 * Closes open sessions that have been open for more than 4 hours.
 * Deducts the standard (non-peak, no discount) base rate for the venue tier.
 *
 * Called by:
 *  1. Vercel cron job (vercel.json) — runs every 15 min in production
 *  2. GET variant below — also for the Vercel cron (cron jobs send GET)
 *
 * NOT called from client-side fetches or other API routes — doing so
 * without proper auth cookies causes internal request failures that
 * corrupt the Supabase SSR cookie state.
 *
 * This is idempotent — safe to call multiple times.
 */
export async function POST() {
  return runAutoClose();
}

// Vercel cron sends GET requests
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runAutoClose();
}

export async function runAutoClose() {
  const adminSupabase = createAdminClient();

  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago

  const { data: staleSessions, error } = await adminSupabase
    .from('sessions')
    .select(`
      id, user_id, venue_id, booking_id, entry_scanned_at,
      venues!inner(name, tier)
    `)
    .eq('status', 'open')
    .lt('entry_scanned_at', cutoff.toISOString());

  if (error) {
    console.error('auto-close fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch stale sessions' }, { status: 500 });
  }

  if (!staleSessions || staleSessions.length === 0) {
    return NextResponse.json({ closed: 0, message: 'No stale sessions found' });
  }

  const TIER_BASE_RATES: Record<string, number> = { bronze: 6, silver: 10, gold: 16 };
  const closedAt = new Date();
  let closedCount = 0;

  for (const session of staleSessions) {
    const venue = session.venues as any;
    const baseRate = TIER_BASE_RATES[venue.tier] ?? 6;
    const tokensToDeduct = baseRate;

    try {
      await adminSupabase
        .from('sessions')
        .update({
          status: 'auto_closed',
          auto_closed_at: closedAt.toISOString(),
          exit_scanned_at: closedAt.toISOString(),
          tokens_deducted: tokensToDeduct,
        })
        .eq('id', session.id);

      await adminSupabase.from('token_ledger').insert({
        user_id: session.user_id,
        type: 'deduction',
        amount: -tokensToDeduct,
        balance_after: 0,
        notes: `Auto-close at ${venue.name} — session exceeded 4 hours`,
        session_id: session.id,
        venue_id: session.venue_id,
      });

      await adminSupabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', session.booking_id);

      await adminSupabase.from('audit_log').insert({
        event_type: 'auto_close',
        user_id: session.user_id,
        venue_id: session.venue_id,
        session_id: session.id,
        booking_id: session.booking_id,
        token_delta: -tokensToDeduct,
        metadata: {
          entry_scanned_at: session.entry_scanned_at,
          auto_closed_at: closedAt.toISOString(),
          tokens_deducted: tokensToDeduct,
          reason: 'session_exceeded_4_hours',
        },
      });

      closedCount++;
    } catch (err) {
      console.error(`Failed to auto-close session ${session.id}:`, err);
    }
  }

  return NextResponse.json({
    closed: closedCount,
    total_stale: staleSessions.length,
    message: `Auto-closed ${closedCount} sessions`,
  });
}
