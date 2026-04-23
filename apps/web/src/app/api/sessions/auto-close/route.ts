import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/sessions/auto-close
 *
 * Closes any open sessions that have been open for > 4 hours without an exit scan.
 * Deducts standard (non-peak, no discount) token rate.
 *
 * FREE TIER REPLACEMENT for pg_cron:
 * - Called automatically when user opens the Active Session screen
 * - Called automatically when gym owner opens the scan portal
 * - Can also be triggered via a Vercel cron job (free on hobby plan)
 *   by adding vercel.json: { "crons": [{ "path": "/api/sessions/auto-close", "schedule": "*/15 * * * *" }] }
 *
 * This is idempotent — safe to call multiple times.
 */
export async function POST() {
  return runAutoClose();
}

// Also allow GET for Vercel cron (cron jobs use GET by default)
export async function GET(req: Request) {
  // Only allow from Vercel cron (has Authorization header) or in dev
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runAutoClose();
}

async function runAutoClose() {
  const adminSupabase = createAdminClient();

  const cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago

  // Find open sessions older than 4 hours
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
    // Auto-close uses standard (non-peak, no discount) rate
    const tokensToDeduct = baseRate;

    try {
      // Update session to auto_closed
      await adminSupabase
        .from('sessions')
        .update({
          status: 'auto_closed',
          auto_closed_at: closedAt.toISOString(),
          exit_scanned_at: closedAt.toISOString(),
          tokens_deducted: tokensToDeduct,
        })
        .eq('id', session.id);

      // Deduct tokens
      await adminSupabase.from('token_ledger').insert({
        user_id: session.user_id,
        type: 'deduction',
        amount: -tokensToDeduct,           // negative = debit
        balance_after: 0,                  // conservative — actual balance not known here
        notes: `Auto-close at ${venue.name} — session exceeded 4 hours`,
        session_id: session.id,
        venue_id: session.venue_id,
      });

      // Mark booking completed
      await adminSupabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', session.booking_id);

      // Write audit log
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
