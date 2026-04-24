import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/gym/ratings
 *
 * Returns ratings for the authenticated gym owner's venue.
 * Query params:
 *   - page:  number (default: 1)
 *   - limit: number (default: 20, max: 50)
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
    .select('id, name, avg_rating, total_ratings')
    .eq('owner_user_id', profile.id)
    .maybeSingle();

  if (!venue) {
    return NextResponse.json({ ratings: [], total: 0, avg_rating: 0, total_ratings: 0 });
  }

  const { searchParams } = new URL(request.url);
  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  const { data: ratings, count, error } = await supabase
    .from('ratings')
    .select(`
      id,
      score,
      note,
      created_at,
      user:users ( name )
    `, { count: 'exact' })
    .eq('venue_id', venue.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[GET /api/gym/ratings]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Score distribution
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  (ratings ?? []).forEach((r: any) => {
    if (r.score >= 1 && r.score <= 5) distribution[r.score]++;
  });

  return NextResponse.json({
    ratings: ratings ?? [],
    total: count ?? 0,
    page,
    limit,
    avg_rating: venue.avg_rating,
    total_ratings: venue.total_ratings,
    distribution,
  });
}
