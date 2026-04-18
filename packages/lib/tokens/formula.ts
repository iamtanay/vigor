import type { VenueTier } from '@vigor/types';

// Tier base rates (tokens per session)
export const TIER_BASE_RATES: Record<VenueTier, number> = {
  bronze: 6,
  silver: 10,
  gold: 16,
};

// Multiplier limits — enforced here AND at DB level
export const PEAK_MAX_MULTIPLIER = 2.0;
export const OFFPEAK_MIN_MULTIPLIER = 0.6;

export interface DeductionInput {
  tier: VenueTier;
  multiplier: number;       // 0.6–2.0
  commitmentDiscount: number; // 0.0–0.5 (e.g. 0.1 = 10% off)
}

export function calculateDeduction(input: DeductionInput): number {
  const { tier, multiplier, commitmentDiscount } = input;

  const clampedMultiplier = Math.min(
    Math.max(multiplier, OFFPEAK_MIN_MULTIPLIER),
    PEAK_MAX_MULTIPLIER
  );

  const base = TIER_BASE_RATES[tier];
  const withMultiplier = base * clampedMultiplier;
  const withDiscount = withMultiplier * (1 - commitmentDiscount);

  return Math.ceil(withDiscount); // always round up — platform favours itself
}
