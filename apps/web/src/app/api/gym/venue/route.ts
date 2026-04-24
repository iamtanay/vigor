import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const EDITABLE_FIELDS = new Set([
  'name',
  'description',
  'opening_time',
  'closing_time',
  'phone',
  'amenities',
  'activity_types',
]);

async function resolveOwnerVenue(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401, venue: null, profile: null };

  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .limit(1)
    .single();

  if (!profile || !['gym_owner', 'admin'].includes(profile.role)) {
    return { error: 'Forbidden', status: 403, venue: null, profile: null };
  }

  // Fetch all venues for this owner, prefer active, take first
  const { data: venues } = await supabase
    .from('venues')
    .select('*')
    .eq('owner_user_id', profile.id)
    .order('status', { ascending: true }); // 'active' sorts before 'inactive'/'suspended'

  const venue = venues?.find(v => v.status === 'active') ?? venues?.[0] ?? null;

  return { error: null, status: 200, venue, profile };
}

export async function GET() {
  const supabase = await createClient();
  const { error, status, venue } = await resolveOwnerVenue(supabase);
  if (error) return NextResponse.json({ error }, { status });
  if (!venue) return NextResponse.json({ error: 'No venue found' }, { status: 404 });
  return NextResponse.json({ venue });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { error, status, venue } = await resolveOwnerVenue(supabase);
  if (error) return NextResponse.json({ error }, { status });
  if (!venue) return NextResponse.json({ error: 'No venue found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (EDITABLE_FIELDS.has(key)) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  for (const timeField of ['opening_time', 'closing_time'] as const) {
    if (updates[timeField] !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(updates[timeField] as string)) {
        return NextResponse.json({ error: `${timeField} must be HH:MM` }, { status: 400 });
      }
    }
  }

  for (const arrField of ['amenities', 'activity_types'] as const) {
    if (updates[arrField] !== undefined && !Array.isArray(updates[arrField])) {
      return NextResponse.json({ error: `${arrField} must be an array` }, { status: 400 });
    }
  }

  updates.updated_at = new Date().toISOString();

  // Scope strictly to the resolved venue id — never touches other rows
  const { data: updated, error: updateError } = await supabase
    .from('venues')
    .update(updates)
    .eq('id', venue.id)
    .select()
    .maybeSingle();

  if (updateError) {
    console.error('[PATCH /api/gym/venue]', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: 'Update failed — venue not found or permission denied' }, { status: 404 });
  }

  return NextResponse.json({ venue: updated });
}