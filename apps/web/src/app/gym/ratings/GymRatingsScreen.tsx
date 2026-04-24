'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import VigorLogo from '@/components/VigorLogo';

interface RatingRow {
  id: string;
  score: number;
  note: string | null;
  created_at: string;
  user: { name: string | null } | null;
}

interface RatingsResponse {
  ratings: RatingRow[];
  total: number;
  page: number;
  limit: number;
  avg_rating: number;
  total_ratings: number;
  distribution: Record<string, number>;
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

function StarRow({ score, filled }: { score: number; filled: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ fontSize: 14, color: i <= score ? '#FFD166' : 'rgba(255,255,255,0.12)' }}>★</span>
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function GymRatingsScreen() {
  const [data, setData]       = useState<RatingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const LIMIT = 20;

  const fetchRatings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      const res = await fetch(`/api/gym/ratings?${params}`);
      if (!res.ok) throw new Error('Failed');
      setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchRatings(); }, [fetchRatings]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
  const maxCount = data
    ? Math.max(1, ...Object.values(data.distribution))
    : 1;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-deep-space)', fontFamily: 'system-ui', paddingBottom: 80 }}>

      <header style={{
        padding: '16px 20px',
        background: 'rgba(26,26,46,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <VigorLogo height={26} />
        <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>Ratings & Reviews</div>
        <div style={{ width: 60 }} />
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {loading && !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[140, 80, 80].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : (
          <>
            {/* Score overview */}
            <div style={{
              background: 'var(--color-card-dark)', borderRadius: 18,
              padding: '20px', marginBottom: 16,
              display: 'flex', gap: 24, alignItems: 'center',
            }}>
              {/* Big score */}
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 52, fontWeight: 600, color: '#FFD166', lineHeight: 1 }}>
                  {(data?.avg_rating ?? 0).toFixed(1)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6, gap: 2 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} style={{
                      fontSize: 14,
                      color: i <= Math.round(data?.avg_rating ?? 0) ? '#FFD166' : 'rgba(255,255,255,0.12)',
                    }}>★</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                  {data?.total_ratings ?? 0} reviews
                </div>
              </div>

              {/* Distribution bars */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[5, 4, 3, 2, 1].map(star => {
                  const count = data?.distribution[String(star)] ?? 0;
                  const pct   = Math.round((count / maxCount) * 100);
                  return (
                    <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', width: 10, textAlign: 'right' }}>
                        {star}
                      </div>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 3,
                          width: `${pct}%`,
                          background: star >= 4 ? '#FFD166' : star === 3 ? '#6C63FF' : '#FF6B6B',
                          transition: 'width 0.5s ease-out',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', width: 20 }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Review list */}
            <div style={{
              fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
            }}>
              Recent reviews
            </div>

            {(data?.ratings ?? []).length === 0 ? (
              <div style={{
                textAlign: 'center', padding: '48px 20px',
                color: 'rgba(255,255,255,0.2)', fontSize: 14,
                background: 'var(--color-card-dark)', borderRadius: 14,
              }}>
                No reviews yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data?.ratings ?? []).map(r => (
                  <div key={r.id} style={{
                    background: 'var(--color-card-dark)',
                    borderRadius: 14, padding: '14px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: 'rgba(108,99,255,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 600, color: '#6C63FF',
                        }}>
                          {(r.user?.name ?? 'A').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                            {r.user?.name ?? 'Anonymous'}
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>
                            {formatDate(r.created_at)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {[1, 2, 3, 4, 5].map(i => (
                          <span key={i} style={{ fontSize: 13, color: i <= r.score ? '#FFD166' : 'rgba(255,255,255,0.1)' }}>★</span>
                        ))}
                      </div>
                    </div>
                    {r.note && (
                      <div style={{
                        fontSize: 13, color: 'rgba(255,255,255,0.6)',
                        lineHeight: 1.55, paddingLeft: 40,
                      }}>
                        {r.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 24 }}>
                <button
                  disabled={page <= 1 || loading}
                  onClick={() => setPage(p => p - 1)}
                  style={{
                    padding: '8px 18px', borderRadius: 10, fontSize: 13, border: 'none',
                    background: page <= 1 ? 'rgba(255,255,255,0.04)' : 'rgba(108,99,255,0.2)',
                    color: page <= 1 ? 'rgba(255,255,255,0.2)' : '#6C63FF',
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  }}
                >← Prev</button>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{page} / {totalPages}</span>
                <button
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(p => p + 1)}
                  style={{
                    padding: '8px 18px', borderRadius: 10, fontSize: 13, border: 'none',
                    background: page >= totalPages ? 'rgba(255,255,255,0.04)' : 'rgba(108,99,255,0.2)',
                    color: page >= totalPages ? 'rgba(255,255,255,0.2)' : '#6C63FF',
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  }}
                >Next →</button>
              </div>
            )}
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
        <NavLink href="/gym/settlements" icon="💳" label="Settle" />
        <NavLink href="/gym/venue"       icon="⚙️" label="Venue" />
      </nav>
    </div>
  );
}
