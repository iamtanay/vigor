import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, expires_at, grace_expires_at')
    .eq('user_id', profile.id);

  const now = new Date();
  let available = 0;
  let grace = 0;
  let earliestExpiry: string | null = null;

  for (const e of ledger ?? []) {
    if (e.amount <= 0) {
      available += e.amount; // debits
      continue;
    }
    if (e.expires_at && new Date(e.expires_at) < now) {
      if (e.grace_expires_at && new Date(e.grace_expires_at) > now) {
        grace += Math.floor(e.amount * 0.5);
      }
    } else {
      available += e.amount;
      if (e.expires_at && (!earliestExpiry || e.expires_at < earliestExpiry)) {
        earliestExpiry = e.expires_at;
      }
    }
  }

  return NextResponse.json({
    available: Math.max(available, 0),
    grace,
    earliestExpiry,
  });
}
