'use client';

import { useState } from 'react';

const TYPE_LABELS: Record<string, { label: string; color: string; sign: string }> = {
  purchase:        { label: 'Tokens purchased',    color: '#39D98A', sign: '+' },
  deduction:       { label: 'Session',              color: '#FF6B6B', sign: '−' },
  refund:          { label: 'Refund',               color: '#39D98A', sign: '+' },
  penalty:         { label: 'Cancellation penalty', color: '#FF6B6B', sign: '−' },
  grace_deduction: { label: 'Grace period use',    color: '#FFD166', sign: '−' },
  compensation:    { label: 'Compensation credit',  color: '#39D98A', sign: '+' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

interface Bundle {
  id: string; name: string; size: string;
  token_count: number; price_inr: number; validity_days: number;
}

interface LedgerEntry {
  id: string; type: string; amount: number; balance_after: number;
  notes: string | null; created_at: string; expires_at: string | null;
  token_bundles: any; venues?: any;
}

interface Props {
  availableTokens: number;
  graceTokens: number;
  earliestExpiry: string | null;
  ledger: LedgerEntry[];
  bundles: Bundle[];
  blockedTokens?: number;
}

export default function WalletScreen({ availableTokens, graceTokens, earliestExpiry, ledger, bundles, blockedTokens = 0 }: Props) {
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [showHistory, setShowHistory] = useState<'all' | 'credits' | 'debits'>('all');

  const expiryDays = earliestExpiry ? daysUntil(earliestExpiry) : null;
  const spendable = Math.max(availableTokens - blockedTokens, 0);

  const filteredLedger = ledger.filter(e => {
    if (showHistory === 'credits') return e.amount > 0;
    if (showHistory === 'debits') return e.amount < 0;
    return true;
  });

  async function handlePurchase() {
    if (!selectedBundle) return;
    setPurchasing(true);
    try {
      const res = await fetch('/api/wallet/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bundleId: selectedBundle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Purchase failed');
      window.location.reload();
    } catch (err: any) {
      alert(err.message ?? 'Purchase failed. Please try again.');
      setPurchasing(false);
    }
  }

  const perTokenCost = (b: Bundle) => (b.price_inr / b.token_count / 100).toFixed(2);

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
          Your wallet
        </div>
        <div style={{ fontSize: 26, fontWeight: 500, color: '#fff', letterSpacing: '-0.03em' }}>Tokens</div>
      </div>

      {/* Balance card */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(108,99,255,0.25) 0%, rgba(57,217,138,0.12) 100%)',
          border: '1px solid rgba(108,99,255,0.3)',
          borderRadius: 20, padding: '24px',
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>Available balance</div>
          <div style={{ fontSize: 48, fontWeight: 600, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>
            {availableTokens}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>tokens</div>

          {/* Blocked tokens indicator */}
          {blockedTokens > 0 && (
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 12, color: '#FFD166' }}>
                🔒 {blockedTokens} held for upcoming bookings
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#39D98A' }}>
                {spendable} free
              </span>
            </div>
          )}

          {graceTokens > 0 && (
            <div style={{ marginTop: blockedTokens > 0 ? 6 : 12, paddingTop: 6 }}>
              <span style={{ fontSize: 12, color: '#FFD166' }}>+ {graceTokens} grace tokens (50% value)</span>
            </div>
          )}

          {earliestExpiry && expiryDays !== null && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                height: 4, flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  background: expiryDays <= 7 ? '#FF6B6B' : expiryDays <= 15 ? '#FFD166' : '#39D98A',
                  width: `${Math.min(100, (expiryDays / 90) * 100)}%`,
                }} />
              </div>
              <span style={{
                fontSize: 11, fontWeight: 500,
                color: expiryDays <= 7 ? '#FF6B6B' : expiryDays <= 15 ? '#FFD166' : 'rgba(255,255,255,0.4)',
                whiteSpace: 'nowrap',
              }}>
                {expiryDays}d left
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Bundle selector */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)', marginBottom: 14 }}>
          Buy tokens
        </div>

        {bundles.length === 0 ? (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>No bundles available</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bundles.map(b => {
              const selected = selectedBundle === b.id;
              const isRecommended = b.size === 'medium';
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBundle(selected ? null : b.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px',
                    background: selected ? 'rgba(108,99,255,0.15)' : 'var(--color-card-dark)',
                    border: `1px solid ${selected ? '#6C63FF' : isRecommended ? 'rgba(57,217,138,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, cursor: 'pointer', position: 'relative',
                  }}
                >
                  {isRecommended && (
                    <span style={{
                      position: 'absolute', top: -8, left: 14,
                      fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                      background: '#39D98A', color: '#0D2818', padding: '2px 8px', borderRadius: 6,
                    }}>Best value</span>
                  )}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{b.token_count} tokens</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
                      Valid {b.validity_days} days · ₹{perTokenCost(b)}/token
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>
                      ₹{(b.price_inr / 100).toFixed(0)}
                    </div>
                    {selected && (
                      <div style={{ fontSize: 11, color: '#6C63FF', marginTop: 2 }}>Selected ✓</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedBundle && (
          <button
            onClick={handlePurchase}
            disabled={purchasing}
            style={{
              width: '100%', marginTop: 14, padding: '15px',
              background: '#6C63FF', border: 'none', borderRadius: 14,
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            {purchasing ? 'Processing…' : 'Buy tokens'}
          </button>
        )}

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', margin: '10px 0 0' }}>
          Payments powered by Razorpay — coming soon
        </p>
      </div>

      {/* Transaction history */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)' }}>
            History
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'credits', 'debits'] as const).map(f => (
              <button key={f} onClick={() => setShowHistory(f)} style={{
                padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: showHistory === f ? 'rgba(108,99,255,0.2)' : 'transparent',
                color: showHistory === f ? '#6C63FF' : 'rgba(255,255,255,0.35)',
                fontSize: 11, fontWeight: 500, textTransform: 'capitalize',
              }}>{f}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filteredLedger.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '24px 0' }}>
              No transactions yet
            </div>
          ) : (
            filteredLedger.map((entry, i) => {
              const meta = TYPE_LABELS[entry.type] ?? { label: entry.type, color: '#fff', sign: '' };
              const isCredit = entry.amount > 0;
              return (
                <div key={entry.id ?? i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 0',
                  borderBottom: '0.5px solid rgba(255,255,255,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: isCredit ? 'rgba(57,217,138,0.1)' : 'rgba(255,107,107,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, flexShrink: 0,
                    }}>
                      {isCredit ? '↓' : '↑'}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                        {entry.token_bundles?.name ?? meta.label}
                        {entry.notes ? ` — ${entry.notes}` : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        {formatDate(entry.created_at)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: meta.color }}>
                      {meta.sign}{Math.abs(entry.amount)}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                      {entry.balance_after} left
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
