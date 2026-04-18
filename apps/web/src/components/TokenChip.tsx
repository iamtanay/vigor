'use client';

import Link from 'next/link';

export default function TokenChip({ balance }: { balance: number }) {
  return (
    <Link
      href="/app/wallet"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        background: 'rgba(108,99,255,0.15)',
        border: '1px solid rgba(108,99,255,0.3)',
        borderRadius: 20,
        textDecoration: 'none',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: '#A09BFF', letterSpacing: '-0.01em' }}>
        {balance}
      </span>
      <span style={{ fontSize: 11, color: 'rgba(160,155,255,0.65)', fontWeight: 500 }}>tokens</span>
    </Link>
  );
}
