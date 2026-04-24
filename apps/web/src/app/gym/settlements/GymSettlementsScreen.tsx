'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import VigorLogo from '@/components/VigorLogo';

interface CyclePreview {
  start: string;
  end: string;
  tokens_consumed: number;
  session_count: number;
  avg_session_dur_sec: number;
  estimated_payout_inr: number;
}

interface SettlementRecord {
  id: string;
  cycle_start: string;
  cycle_end: string;
  tokens_consumed: number;
  payout_rate_inr: number;
  total_payout_inr: number;
  status: 'pending' | 'approved' | 'paid';
  approved_at: string | null;
  paid_at: string | null;
}

interface VenueInfo {
  id: string;
  name: string;
  tier: string;
  payout_rate_inr: number;
}

function NavLink({ href, icon, label, active }: { href: string; icon: string; label: string; active?: boolean }) {
  return (
    <Link href={href} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
      padding: '8px 12px', borderRadius: 10, textDecoration: 'none',
      background: active ? 'rgba(108,99,255,0.12)' : 'transparent',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{
        fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase',
        color: active ? '#6C63FF' : 'rgba(255,255,255,0.4)',
      }}>{label}</span>
    </Link>
  );
}

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const STATUS_BADGE: Record<SettlementRecord['status'], { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: '#FFD166', bg: 'rgba(255,209,102,0.12)' },
  approved: { label: 'Approved', color: '#6C63FF', bg: 'rgba(108,99,255,0.12)'  },
  paid:     { label: 'Paid',     color: '#39D98A', bg: 'rgba(57,217,138,0.12)'  },
};

// Quick cycle presets
const CYCLE_PRESETS = [
  { label: 'This month', getValue: () => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end: now.toISOString() };
  }},
  { label: 'Last month', getValue: () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { start: start.toISOString(), end: end.toISOString() };
  }},
  { label: 'Last 7 days', getValue: () => {
    const now   = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString() };
  }},
];

export default function GymSettlementsScreen() {
  const [preview, setPreview]   = useState<CyclePreview | null>(null);
  const [history, setHistory]   = useState<SettlementRecord[]>([]);
  const [venue, setVenue]       = useState<VenueInfo | null>(null);
  const [loading, setLoading]   = useState(true);
  const [preset, setPreset]     = useState(0);

  async function fetchData(cycleStart: string, cycleEnd: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ cycle_start: cycleStart, cycle_end: cycleEnd });
      const res = await fetch(`/api/gym/settlement?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPreview(data.current_cycle);
      setHistory(data.history ?? []);
      setVenue(data.venue ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const { start, end } = CYCLE_PRESETS[preset]!.getValue();
    fetchData(start, end);
  }, [preset]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-deep-space)', fontFamily: 'system-ui', paddingBottom: 80 }}>

      <header style={{
        padding: '16px 20px',
        background: 'rgba(26,26,46,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <VigorLogo height={26} />
        <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>Settlements</div>
        <div style={{ width: 60 }} />
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* Cycle preset tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {CYCLE_PRESETS.map((p, i) => (
            <button
              key={p.label}
              onClick={() => setPreset(i)}
              style={{
                flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                background: preset === i ? '#6C63FF' : 'rgba(255,255,255,0.07)',
                color: preset === i ? '#fff' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[120, 80, 80, 80].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : (
          <>
            {/* Current cycle — big payout card */}
            {preview && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(108,99,255,0.2) 0%, rgba(57,217,138,0.08) 100%)',
                border: '1px solid rgba(108,99,255,0.3)',
                borderRadius: 18, padding: '20px 20px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  Estimated payout
                </div>
                <div style={{ fontSize: 36, fontWeight: 600, color: '#39D98A', letterSpacing: '-0.02em', marginBottom: 16 }}>
                  {formatPaise(preview.estimated_payout_inr)}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Tokens consumed', value: preview.tokens_consumed, color: '#FFD166' },
                    { label: 'Sessions',         value: preview.session_count,   color: '#6C63FF' },
                    { label: 'Avg duration',     value: formatDuration(preview.avg_session_dur_sec), color: '#fff' },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: 18, fontWeight: 500, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {venue && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                      Payout rate: <span style={{ color: '#39D98A' }}>{formatPaise(venue.payout_rate_inr)}</span> per token
                      · Cycle: {formatDate(preview.start)} – {formatDate(preview.end)}
                    </div>
                  </div>
                )}

                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: 'rgba(255,209,102,0.08)', borderRadius: 10,
                  fontSize: 11, color: 'rgba(255,209,102,0.7)', lineHeight: 1.5,
                }}>
                  ℹ️ Payouts require admin approval. Settlement is processed at the end of each cycle.
                </div>
              </div>
            )}

            {/* Token consumption breakdown bar */}
            {preview && preview.tokens_consumed > 0 && (
              <div style={{ background: 'var(--color-card-dark)', borderRadius: 14, padding: '16px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
                  Cycle progress
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (preview.tokens_consumed / Math.max(preview.tokens_consumed, 500)) * 100)}%`,
                        background: 'linear-gradient(90deg, #6C63FF, #39D98A)',
                        borderRadius: 4,
                        transition: 'width 0.6s ease-out',
                      }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#FFD166', whiteSpace: 'nowrap' }}>
                    {preview.tokens_consumed} tokens
                  </div>
                </div>
              </div>
            )}

            {/* Settlement history */}
            <div style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
                textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
              }}>
                Settlement history
              </div>

              {history.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '32px 20px',
                  color: 'rgba(255,255,255,0.2)', fontSize: 13,
                  background: 'var(--color-card-dark)', borderRadius: 14,
                }}>
                  No past settlements yet
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {history.map(s => {
                    const badge = STATUS_BADGE[s.status];
                    return (
                      <div key={s.id} style={{
                        background: 'var(--color-card-dark)',
                        borderRadius: 14, padding: '14px 16px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', marginBottom: 3 }}>
                              {formatDate(s.cycle_start)} – {formatDate(s.cycle_end)}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                              {s.tokens_consumed} tokens · {formatPaise(s.payout_rate_inr)}/token
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                            <div style={{ fontSize: 16, fontWeight: 500, color: '#39D98A' }}>
                              {formatPaise(s.total_payout_inr)}
                            </div>
                            <span style={{
                              fontSize: 10, fontWeight: 600, letterSpacing: '0.04em',
                              padding: '2px 8px', borderRadius: 6,
                              background: badge.bg, color: badge.color,
                            }}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                        {s.paid_at && (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                            Paid {formatDate(s.paid_at)}
                          </div>
                        )}
                        {s.approved_at && !s.paid_at && (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                            Approved {formatDate(s.approved_at)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(26,26,46,0.96)', backdropFilter: 'blur(16px)',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))', zIndex: 50,
      }}>
        <NavLink href="/gym"             icon="🏠" label="Dashboard" />
        <NavLink href="/gym/scan"        icon="📷" label="Scan" />
        <NavLink href="/gym/sessions"    icon="📋" label="Sessions" />
        <NavLink href="/gym/settlements" icon="💳" label="Settle" active />
        <NavLink href="/gym/venue"       icon="⚙️" label="Venue" />
      </nav>
    </div>
  );
}
