import type { VenueTier } from '@vigor/types';

const TIER_STYLES: Record<VenueTier, { bg: string; color: string; border: string }> = {
  bronze: { bg: 'rgba(205,127,50,0.15)', color: '#CD7F32', border: 'rgba(205,127,50,0.3)' },
  silver: { bg: 'rgba(180,180,185,0.15)', color: '#8A9BB5', border: 'rgba(180,180,185,0.3)' },
  gold:   { bg: 'rgba(255,193,7,0.15)',   color: '#B8860B', border: 'rgba(255,193,7,0.3)'   },
};

export default function TierBadge({ tier }: { tier: VenueTier }) {
  const s = TIER_STYLES[tier];
  return (
    <span style={{
      fontSize: 10, fontWeight: 500,
      padding: '3px 8px', borderRadius: 10,
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      textTransform: 'capitalize',
    }}>
      {tier}
    </span>
  );
}
