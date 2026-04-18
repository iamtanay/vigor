'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import TierBadge from '@/components/TierBadge';
import TokenChip from '@/components/TokenChip';
import { TIER_BASE_RATES } from '@vigor/lib/tokens/formula';
import type { Venue, VenueTier } from '@vigor/types';

const ACTIVITY_FILTERS = ['All', 'Gym', 'CrossFit', 'Yoga', 'Swimming', 'Zumba', 'Cardio'];
const TIER_FILTERS: (VenueTier | 'all')[] = ['all', 'gold', 'silver', 'bronze'];

function getHour() { return new Date().getHours(); }
function isPeakHour() { const h = getHour(); return (h >= 6 && h <= 9) || (h >= 17 && h <= 21); }

export default function ExploreScreen({ venues, tokenBalance }: { venues: Partial<Venue>[]; tokenBalance: number }) {
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState<VenueTier | 'all'>('all');
  const [sortBy, setSortBy] = useState<'rating' | 'tokens_low' | 'tokens_high'>('rating');
  const isPeak = isPeakHour();

  const filtered = useMemo(() => {
    let list = [...venues];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v =>
        v.name?.toLowerCase().includes(q) ||
        v.city?.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q)
      );
    }

    if (activityFilter !== 'All') {
      list = list.filter(v =>
        v.activity_types?.some(a => a.toLowerCase().includes(activityFilter.toLowerCase()))
      );
    }

    if (tierFilter !== 'all') {
      list = list.filter(v => v.tier === tierFilter);
    }

    if (sortBy === 'rating') {
      list.sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0));
    } else if (sortBy === 'tokens_low') {
      list.sort((a, b) => (TIER_BASE_RATES[a.tier ?? 'bronze']) - (TIER_BASE_RATES[b.tier ?? 'bronze']));
    } else {
      list.sort((a, b) => (TIER_BASE_RATES[b.tier ?? 'bronze']) - (TIER_BASE_RATES[a.tier ?? 'bronze']));
    }

    return list;
  }, [venues, search, activityFilter, tierFilter, sortBy]);

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 8 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>Explore</div>
        <TokenChip balance={tokenBalance} />
      </div>

      {/* Search bar */}
      <div style={{ padding: '0 20px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--color-card-dark)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '11px 14px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="2"/>
            <path d="M17 17 L21 21" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search gyms, studios, cities…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: '#fff', fontSize: 14,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>
          )}
        </div>
      </div>

      {/* Activity filter chips */}
      <div style={{ paddingBottom: 12, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, padding: '0 20px' }}>
          {ACTIVITY_FILTERS.map(f => (
            <button key={f} onClick={() => setActivityFilter(f)} style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 20,
              border: `1px solid ${activityFilter === f ? '#6C63FF' : 'rgba(255,255,255,0.1)'}`,
              background: activityFilter === f ? 'rgba(108,99,255,0.15)' : 'transparent',
              color: activityFilter === f ? '#6C63FF' : 'rgba(255,255,255,0.5)',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>{f}</button>
          ))}
        </div>
      </div>

      {/* Tier + Sort row */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {TIER_FILTERS.map(t => (
            <button key={t} onClick={() => setTierFilter(t)} style={{
              padding: '5px 12px', borderRadius: 8,
              border: `1px solid ${tierFilter === t ? '#6C63FF' : 'rgba(255,255,255,0.08)'}`,
              background: tierFilter === t ? 'rgba(108,99,255,0.12)' : 'transparent',
              color: tierFilter === t ? '#6C63FF' :
                t === 'gold' ? '#B8860B' :
                t === 'silver' ? '#8A9BB5' :
                t === 'bronze' ? '#CD7F32' : 'rgba(255,255,255,0.4)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', textTransform: 'capitalize',
            }}>{t === 'all' ? 'All tiers' : t}</button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          style={{
            marginLeft: 'auto', background: 'var(--color-card-dark)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            color: 'rgba(255,255,255,0.6)', fontSize: 12, padding: '5px 10px', cursor: 'pointer',
          }}
        >
          <option value="rating">Top rated</option>
          <option value="tokens_low">Cheapest first</option>
          <option value="tokens_high">Premium first</option>
        </select>
      </div>

      {/* Results count */}
      <div style={{ padding: '0 20px 12px' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          {filtered.length} venue{filtered.length !== 1 ? 's' : ''}
          {isPeak && <span style={{ color: '#FF6B6B', marginLeft: 8 }}>· Peak hours active</span>}
        </span>
      </div>

      {/* Venue list */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
            No venues match your filters
          </div>
        ) : (
          filtered.map((venue, i) => (
            <ExploreVenueCard key={venue.id} venue={venue} isPeak={isPeak} delay={i * 40} />
          ))
        )}
      </div>
    </div>
  );
}

function ExploreVenueCard({ venue, isPeak, delay }: { venue: Partial<Venue>; isPeak: boolean; delay: number }) {
  const base = TIER_BASE_RATES[venue.tier ?? 'bronze'];
  const peakCost = Math.ceil(base * 1.5);
  const offPeakCost = base;

  return (
    <Link href={`/app/venue/${venue.id}`} style={{ textDecoration: 'none' }} className="card-enter">
      <div style={{
        background: 'var(--color-card-dark)',
        borderRadius: 14,
        border: '0.5px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        animationDelay: `${delay}ms`,
      }}>
        {/* Image placeholder */}
        <div style={{
          height: 90,
          background: `linear-gradient(135deg, rgba(108,99,255,0.15) 0%, rgba(57,217,138,0.08) 100%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderBottom: '0.5px solid rgba(255,255,255,0.05)',
        }}>
          {venue.activity_types && venue.activity_types.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              {venue.activity_types.slice(0, 3).map(a => (
                <span key={a} style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 6 }}>{a}</span>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <div style={{ flex: 1, marginRight: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 2 }}>{venue.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)' }}>{venue.city} · {venue.opening_time?.slice(0,5)}–{venue.closing_time?.slice(0,5)}</div>
            </div>
            <TierBadge tier={venue.tier ?? 'bronze'} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: isPeak ? '#FF6B6B' : '#39D98A' }}>
                {isPeak ? peakCost : offPeakCost} tokens
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 6 }}>
                {isPeak ? 'peak' : 'off-peak'}
              </span>
              {!isPeak && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginLeft: 4 }}>
                  · {peakCost} peak
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {(venue.avg_rating ?? 0) > 0 && (
                <span style={{ fontSize: 12, color: '#FFD166' }}>★ {venue.avg_rating?.toFixed(1)}</span>
              )}
              <span style={{
                fontSize: 12, fontWeight: 500, padding: '5px 14px', borderRadius: 20,
                background: '#6C63FF', color: '#fff',
              }}>Book</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
