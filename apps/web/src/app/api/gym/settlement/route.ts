import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/gym/settlement
 *
 * Returns:
 *   - current cycle preview (tokens consumed since last settlement cycle start)
 *   - past settlement records
 *   - estimated payout for current cycle
 *
 * Query params:
 *   - cycle_start: ISO date string (optional; defaults to start of current month)
 *   - cycle_end:   ISO date string (optional; defaults to now)
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .single();

  if (!profile || !['gym_owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, tier, payout_rate_inr')
    .eq('owner_user_id', profile.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!venue) {
    return NextResponse.json({ error: 'No active venue found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);

  // Default cycle: 1st of current month → now
  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const cycleStart = searchParams.get('cycle_start') ?? defaultStart;
  const cycleEnd   = searchParams.get('cycle_end')   ?? now.toISOString();

  // Use admin client to call the SECURITY DEFINER helper function
  const adminSupabase = createAdminClient();

  const { data: preview, error: previewError } = await adminSupabase
    .rpc('get_settlement_preview', {
      p_venue_id: venue.id,
      p_start:    cycleStart,
      p_end:      cycleEnd,
    })
    .single();

  if (previewError) {
    console.error('[GET /api/gym/settlement] preview rpc error', previewError);
    return NextResponse.json({ error: previewError.message }, { status: 500 });
  }

  const tokensConsumed   = Number(preview?.tokens_consumed  ?? 0);
  const sessionCount     = Number(preview?.session_count    ?? 0);
  const avgSessionDurSec = Number(preview?.avg_session_dur  ?? 0);
  const estimatedPayout  = tokensConsumed * venue.payout_rate_inr; // paise

  // Past settlement records for this venue (most recent 12)
  const { data: history } = await supabase
    .from('settlements')
    .select('id, cycle_start, cycle_end, tokens_consumed, payout_rate_inr, total_payout_inr, status, approved_at, paid_at')
    .eq('venue_id', venue.id)
    .order('cycle_start', { ascending: false })
    .limit(12);

  return NextResponse.json({
    venue: {
      id: venue.id,
      name: venue.name,
      tier: venue.tier,
      payout_rate_inr: venue.payout_rate_inr,
    },
    current_cycle: {
      start: cycleStart,
      end:   cycleEnd,
      tokens_consumed:    tokensConsumed,
      session_count:      sessionCount,
      avg_session_dur_sec: avgSessionDurSec,
      estimated_payout_inr: estimatedPayout, // paise
    },
    history: history ?? [],
  });
}
