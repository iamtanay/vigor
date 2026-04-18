import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import WalletScreen from './WalletScreen';

export default async function WalletPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .single();
  if (!profile) redirect('/login');

  // NOTE: Do NOT join venues via session_id here.
  // token_ledger has a session_id column but the FK to sessions was never added
  // in the migrations (it says "FK added after sessions table" — never executed).
  // The join `venues!token_ledger_session_id_fkey` silently errored, returning
  // null for the entire ledger query → 0 balance displayed.
  const { data: ledger, error: ledgerError } = await supabase
    .from('token_ledger')
    .select(`
      id, type, amount, balance_after, notes, created_at, expires_at, grace_expires_at,
      token_bundles!token_ledger_bundle_id_fkey(name, token_count, price_inr)
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (ledgerError) {
    console.error('Ledger fetch error:', ledgerError.message);
  }

  const now = new Date();
  let availableTokens = 0;
  let graceTokens = 0;
  let earliestExpiry: string | null = null;

  for (const e of ledger ?? []) {
    if (e.amount > 0) {
      // Credit entry — check if expired
      if (e.expires_at && new Date(e.expires_at) < now) {
        // Expired — check grace period
        if (e.grace_expires_at && new Date(e.grace_expires_at) > now) {
          graceTokens += Math.floor(e.amount * 0.5);
        }
        // else fully lapsed — skip
      } else {
        availableTokens += e.amount;
        if (e.expires_at && (!earliestExpiry || e.expires_at < earliestExpiry)) {
          earliestExpiry = e.expires_at;
        }
      }
    } else {
      // Debit — amount is negative, just add it
      availableTokens += e.amount;
    }
  }

  const { data: bundles } = await supabase
    .from('token_bundles')
    .select('id, name, size, token_count, price_inr, validity_days, is_active')
    .eq('is_active', true)
    .order('token_count', { ascending: true });

  return (
    <WalletScreen
      availableTokens={Math.max(availableTokens, 0)}
      graceTokens={graceTokens}
      earliestExpiry={earliestExpiry}
      ledger={ledger ?? []}
      bundles={bundles ?? []}
    />
  );
}
