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

  // Fetch ledger without joining venues (venue_id FK on token_ledger may not exist)
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
      if (e.expires_at && new Date(e.expires_at) < now) {
        if (e.grace_expires_at && new Date(e.grace_expires_at) > now) {
          graceTokens += Math.floor(e.amount * 0.5);
        }
      } else {
        availableTokens += e.amount;
        if (e.expires_at && (!earliestExpiry || e.expires_at < earliestExpiry)) {
          earliestExpiry = e.expires_at;
        }
      }
    } else {
      availableTokens += e.amount; // negative debit
    }
  }

  // Fetch confirmed bookings to compute blocked tokens
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select(`
      id, venue_id,
      venues!inner(tier),
      venue_slots!inner(slot_date, start_time)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'confirmed');

  const TIER_BASE_RATES: Record<string, number> = { bronze: 6, silver: 10, gold: 16 };
  let blockedTokens = 0;
  for (const b of activeBookings ?? []) {
    const slot = (b as any).venue_slots;
    const venue = (b as any).venues;
    if (!slot || !venue) continue;
    const slotDt = new Date(`${slot.slot_date}T${slot.start_time}+05:30`);
    if (slotDt > new Date(now.getTime() - 15 * 60 * 1000)) {
      blockedTokens += TIER_BASE_RATES[venue.tier] ?? 6;
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
      blockedTokens={blockedTokens}
    />
  );
}
