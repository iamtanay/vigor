'use client';

import Link from 'next/link';
import { useState } from 'react';
import { TIER_BASE_RATES } from '@vigor/lib/tokens/formula';
import type { Venue } from '@vigor/types';
import TierBadge from '@/components/TierBadge';
import TokenChip from '@/components/TokenChip';

const CATEGORIES = ['All', 'Gym', 'CrossFit', 'Yoga', 'Swimming', 'Zumba'];

interface Props {
  userName: string;
  tokenBalance: number;
  earliestExpiry: string | null;
  venues: Partial<Venue>[];
  upcomingBookings: any[];
  userId: string;
}

function getHour() { return new Date().getHours(); }
function getGreeting() {
  const h = getHour();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function isPeakHour() {
  const h = getHour();
  return (h >= 6 && h <= 9) || (h >= 17 && h <= 21);
}

export default function HomeScreen({ userName, tokenBalance, earliestExpiry, venues, upcomingBookings }: Props) {
  const [activeCategory, setActiveCategory] = useState('All');

  const filteredVenues = activeCategory === 'All'
    ? venues
    : venues.filter(v => v.activity_types?.some(a =>
        a.toLowerCase().includes(activeCategory.toLowerCase())
      ));

  const expiryDays = earliestExpiry
    ? Math.ceil((new Date(earliestExpiry).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="page-slide-in" style={{ minHeight: '100dvh', paddingBottom: 8 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 3 }}>
            {getGreeting()}
          </div>
          <div style={{ fontSize: 26, fontWeight: 500, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Find your workout
          </div>
        </div>
        <TokenChip balance={tokenBalance} />
      </div>

      {/* Expiry warning */}
      {expiryDays !== null && expiryDays <= 7 && (
        <div style={{
          margin: '14px 20px 0',
          background: 'rgba(255,209,102,0.12)',
          border: '1px solid rgba(255,209,102,0.25)',
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <span style={{ fontSize: 12, color: '#FFD166' }}>
            Tokens expire in {expiryDays} day{expiryDays !== 1 ? 's' : ''} — top up soon
          </span>
        </div>
      )}

      {/* Upcoming booking */}
      {upcomingBookings.length > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
            Upcoming
          </div>
          {upcomingBookings.slice(0, 1).map((b: any) => (
            <div key={b.id} className="card-enter" style={{
              background: 'var(--color-card-dark)',
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
                  {b.venues?.name ?? 'Venue'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                  {b.venue_slots?.slot_date} · {b.venue_slots?.start_time?.slice(0, 5)}
                </div>
              </div>
              <Link href={`/app/booking/${b.id}`} style={{
                fontSize: 12, color: '#6C63FF', fontWeight: 500, textDecoration: 'none',
                background: 'rgba(108,99,255,0.12)', padding: '5px 12px', borderRadius: 20,
              }}>
                View →
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Venue list */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.35)' }}>
            Nearby Venues
          </div>
          <Link href="/app/explore" style={{ fontSize: 12, color: '#6C63FF', textDecoration: 'none' }}>
            See all
          </Link>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredVenues.slice(0, 4).map((venue, i) => (
            <VenueCard key={venue.id} venue={venue} animDelay={i * 50} />
          ))}
        </div>
      </div>

      {/* Browse by category */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
          Browse by category
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                flexShrink: 0,
                padding: '8px 16px',
                borderRadius: 20,
                border: `1px solid ${activeCategory === cat ? '#6C63FF' : 'rgba(255,255,255,0.12)'}`,
                background: activeCategory === cat ? 'rgba(108,99,255,0.15)' : 'transparent',
                color: activeCategory === cat ? '#6C63FF' : 'rgba(255,255,255,0.55)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* How it works (for new users) */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>
          How it works
        </div>
        {[
          { n: 1, t: 'Get your QR code' },
          { n: 2, t: 'Check in, work out' },
          { n: 3, t: 'Scan out, you\'re done' },
        ].map(item => (
          <div key={item.n} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 14px',
            marginBottom: 6,
            background: 'var(--color-card-dark)',
            borderRadius: 10,
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{item.n}.</span>
              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>{item.t}</span>
            </div>
            <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>›</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ padding: '20px 20px 0' }}>
        <Link
          href="/app/explore"
          style={{
            display: 'block',
            width: '100%',
            padding: '15px',
            background: '#6C63FF',
            borderRadius: 14,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            textAlign: 'center',
            textDecoration: 'none',
            letterSpacing: '-0.01em',
          }}
        >
          Continue
        </Link>
      </div>
    </div>
  );
}

function VenueCard({ venue, animDelay }: { venue: Partial<Venue>; animDelay: number }) {
  const isPeak = isPeakHour();
  const baseCost = venue.tier ? TIER_BASE_RATES[venue.tier] : 8;
  const tokenCost = isPeak ? Math.ceil(baseCost * 1.5) : baseCost;

  return (
    <Link
      href={`/app/venue/${venue.id}`}
      style={{ textDecoration: 'none' }}
      className="card-enter"
    >
      <div style={{
        background: 'var(--color-card-dark)',
        borderRadius: 14,
        padding: '14px 16px',
        border: '0.5px solid rgba(255,255,255,0.06)',
        animationDelay: `${animDelay}ms`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{venue.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {venue.city} · {venue.opening_time?.slice(0,5)}–{venue.closing_time?.slice(0,5)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {isPeak && (
              <span style={{
                fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 10,
                background: 'rgba(255,107,107,0.15)', color: '#FF6B6B',
                border: '1px solid rgba(255,107,107,0.25)',
              }}>Peak</span>
            )}
            <TierBadge tier={venue.tier ?? 'bronze'} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#39D98A' }}>
              {tokenCost} tokens
            </span>
            {!isPeak && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>off-peak</span>
            )}
          </div>
          <span style={{
            fontSize: 12, fontWeight: 500, padding: '6px 16px', borderRadius: 20,
            background: '#6C63FF', color: '#fff',
          }}>
            Book
          </span>
        </div>
        {venue.activity_types && venue.activity_types.length > 0 && (
          <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
            {venue.activity_types.slice(0, 3).map(a => (
              <span key={a} style={{
                fontSize: 10, color: 'rgba(255,255,255,0.3)',
                background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 8,
              }}>{a}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
