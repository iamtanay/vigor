import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { bundleId } = await req.json();
  if (!bundleId) return NextResponse.json({ error: 'Missing bundleId' }, { status: 400 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data: bundle } = await supabase
    .from('token_bundles')
    .select('id, token_count, price_inr, validity_days, is_active')
    .eq('id', bundleId)
    .eq('is_active', true)
    .single();

  if (!bundle) return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });

  // Get current balance for balance_after calculation
  const { data: ledger } = await supabase
    .from('token_ledger')
    .select('amount, expires_at')
    .eq('user_id', profile.id);

  const now = new Date();
  const currentBalance = (ledger ?? []).reduce((sum: number, e: any) => {
    if (!e.expires_at || new Date(e.expires_at) > now) return sum + e.amount;
    return sum;
  }, 0);

  const expiresAt = new Date(Date.now() + bundle.validity_days * 86400000).toISOString();
  const graceExpiresAt = new Date(Date.now() + (bundle.validity_days + 15) * 86400000).toISOString();

  // STUB: In production, verify Razorpay payment first before inserting ledger entry
  const { data: entry, error } = await supabase
    .from('token_ledger')
    .insert({
      user_id: profile.id,
      bundle_id: bundleId,
      type: 'purchase',
      amount: bundle.token_count,
      balance_after: Math.max(currentBalance, 0) + bundle.token_count,
      expires_at: expiresAt,
      grace_expires_at: graceExpiresAt,
      notes: `Purchased ${bundle.token_count} tokens (stub — payment not verified)`,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Token ledger insert error:', error);
    return NextResponse.json({ error: 'Failed to record purchase' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ledgerEntryId: entry.id,
    tokensAdded: bundle.token_count,
    expiresAt,
    stub: true,
  }, { status: 201 });
}
