import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { data: ledger, error } = await supabase
    .from('token_ledger')
    .select('amount, type, expires_at, grace_expires_at')
    .eq('user_id', profile.id);

  if (error) {
    console.error('Wallet fetch error:', error.message);
    return NextResponse.json({ available: 0, grace: 0, earliestExpiry: null });
  }

  // Fetch active confirmed bookings to compute blocked tokens
  const { data: activeBookings } = await supabase
    .from('bookings')
    .select(`
      id, venue_id,
      venues!inner(tier),
      venue_slots!inner(slot_date, start_time)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'confirmed');

  // Compute how many tokens are "blocked" by upcoming confirmed bookings
  // Block = base_rate for the venue tier (off-peak rate, conservative estimate)
  const TIER_BASE_RATES: Record<string, number> = { bronze: 6, silver: 10, gold: 16 };
  let blockedTokens = 0;
  const now = new Date();
  for (const b of activeBookings ?? []) {
    const slot = (b as any).venue_slots;
    const venue = (b as any).venues;
    if (!slot || !venue) continue;
    // Only block for slots that haven't passed yet (within next 24h + future)
    const slotDt = new Date(`${slot.slot_date}T${slot.start_time}+05:30`);
    if (slotDt > new Date(now.getTime() - 15 * 60 * 1000)) {
      // Block base rate tokens for this booking
      blockedTokens += TIER_BASE_RATES[venue.tier] ?? 6;
    }
  }

  const nowTs = new Date();
  let available = 0;
  let grace = 0;
  let earliestExpiry: string | null = null;

  for (const e of ledger ?? []) {
    if (e.amount > 0) {
      // Credit entry — check expiry
      if (e.expires_at && new Date(e.expires_at) < nowTs) {
        // Expired
        if (e.grace_expires_at && new Date(e.grace_expires_at) > nowTs) {
          grace += Math.floor(e.amount * 0.5);
        }
        // else fully lapsed — ignore
      } else {
        available += e.amount;
        if (e.expires_at && (!earliestExpiry || e.expires_at < earliestExpiry)) {
          earliestExpiry = e.expires_at;
        }
      }
    } else {
      // Debit — negative amount, just sum
      available += e.amount;
    }
  }

  const finalAvailable = Math.max(available, 0);
  const spendable = Math.max(finalAvailable - blockedTokens, 0);

  return NextResponse.json({
    available: finalAvailable,
    spendable,          // tokens NOT blocked by upcoming bookings
    blocked: blockedTokens,
    grace,
    earliestExpiry,
  });
}
