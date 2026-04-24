import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/gym/sessions
 *
 * Returns paginated session history for the authenticated gym owner's venue.
 * Query params:
 *   - range: today | week | month | all  (default: today)
 *   - status: open | closed | auto_closed | all  (default: all)
 *   - page: number (default: 1)
 *   - limit: number (default: 30, max: 100)
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
    return NextResponse.json({ sessions: [], total: 0, venue: null });
  }

  const { searchParams } = new URL(request.url);
  const range  = searchParams.get('range')  ?? 'today';
  const status = searchParams.get('status') ?? 'all';
  const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
  const limit  = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '30', 10)));
  const offset = (page - 1) * limit;

  const now = new Date();
  let rangeStart: string | null = null;
  let rangeEnd:   string | null = null;

  if (range === 'today') {
    const d = now.toISOString().split('T')[0];
    rangeStart = `${d}T00:00:00+00:00`;
    rangeEnd   = `${d}T23:59:59+00:00`;
  } else if (range === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    rangeStart = start.toISOString();
  } else if (range === 'month') {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    rangeStart = start.toISOString();
  }

  // Step 1: fetch sessions + booking id/user_id using admin client so RLS on
  // bookings/users doesn't block reading other members' data
  const admin = createAdminClient();

  let query = admin
    .from('sessions')
    .select(`
      id,
      status,
      entry_scanned_at,
      exit_scanned_at,
      auto_closed_at,
      tokens_deducted,
      scan_method_entry,
      scan_method_exit,
      bookings ( id, user_id )
    `, { count: 'exact' })
    .eq('venue_id', venue.id)
    .order('entry_scanned_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (rangeStart) query = query.gte('entry_scanned_at', rangeStart);
  if (rangeEnd)   query = query.lte('entry_scanned_at', rangeEnd);
  if (status !== 'all') query = query.eq('status', status);

  const { data: sessions, error, count } = await query;

  if (error) {
    console.error('[GET /api/gym/sessions]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Step 2: batch-fetch user names/phones via admin client (bypasses users RLS)
  const userIds = [
    ...new Set(
      (sessions ?? [])
        .map((s: any) => s.bookings?.user_id)
        .filter(Boolean) as string[]
    ),
  ];

  const userMap: Record<string, { name: string | null; phone: string | null }> = {};

  if (userIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('id, name, phone')
      .in('id', userIds);

    for (const u of users ?? []) {
      userMap[u.id] = { name: u.name, phone: u.phone };
    }
  }

  // Step 3: enrich with duration + user info
  const enriched = (sessions ?? []).map((s: any) => {
    const entryAt  = s.entry_scanned_at ? new Date(s.entry_scanned_at) : null;
    const exitAt   = s.exit_scanned_at  ? new Date(s.exit_scanned_at)  : null;
    const closedAt = s.auto_closed_at   ? new Date(s.auto_closed_at)   : null;
    const endTime  = exitAt ?? closedAt;
    const duration_seconds = entryAt && endTime
      ? Math.round((endTime.getTime() - entryAt.getTime()) / 1000)
      : null;

    const userId   = s.bookings?.user_id ?? null;
    const userInfo = userId ? (userMap[userId] ?? null) : null;

    return {
      id:                s.id,
      status:            s.status,
      entry_scanned_at:  s.entry_scanned_at,
      exit_scanned_at:   s.exit_scanned_at,
      auto_closed_at:    s.auto_closed_at,
      tokens_deducted:   s.tokens_deducted,
      scan_method_entry: s.scan_method_entry,
      scan_method_exit:  s.scan_method_exit,
      duration_seconds,
      booking: s.bookings
        ? { id: s.bookings.id, user: userInfo }
        : null,
    };
  });

  return NextResponse.json({
    sessions: enriched,
    total:    count ?? 0,
    page,
    limit,
    venue: {
      id:              venue.id,
      name:            venue.name,
      tier:            venue.tier,
      payout_rate_inr: venue.payout_rate_inr,
    },
  });
}