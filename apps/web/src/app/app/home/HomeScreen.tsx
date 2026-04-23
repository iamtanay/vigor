'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TierBadge from '@/components/TierBadge';
import TokenChip from '@/components/TokenChip';

interface Props {
  user: any;
  venues: any[];
  tokenBalance: number;
  tokenExpiry: string | null;
  upcomingBooking: any | null;
  activeSession: any | null;
}

const TIER_BASE: Record<string, number> = { bronze: 6, silver: 10, gold: 16 };

function tokenCost(tier: string, peak: boolean) {
  const r = TIER_BASE[tier] ?? 6;
  return peak ? Math.ceil(r * 1.5) : r;
}

export default function HomeScreen({ user, venues, tokenBalance, tokenExpiry, upcomingBooking, activeSession }: Props) {
  // All time-dependent state lives in useEffect to avoid SSR/client hydration mismatch.
  // Server renders with neutral defaults; client immediately updates after mount.
  const [greeting, setGreeting] = useState('Welcome');
  const [peak, setPeak] = useState(false);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number | null>(null);

  useEffect(() => {
    const now = new Date();
    const h = now.getHours();

    // Greeting
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');

    // Peak hour (IST): 6–9am and 5–9pm
    // getHours() returns local time — on user's device this IS IST if they're in India
    const isPeak = (h >= 6 && h < 9) || (h >= 17 && h < 21);
    setPeak(isPeak);

    // Token expiry countdown
    if (tokenExpiry) {
      const days = Math.ceil((new Date(tokenExpiry).getTime() - now.getTime()) / (86400 * 1000));
      setDaysUntilExpiry(days);
    }
  }, [tokenExpiry]);

  const activeVenueName = activeSession?.venues?.name ?? null;

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 16 }}>
      {/* Greeting + token chip */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>
            {greeting}
          </div>
          <div style={{ fontSize: 24, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>
            Find your workout
          </div>
        </div>
        <TokenChip balance={tokenBalance} />
      </div>

      {/* Expiry warning */}
      {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
        <div style={{ padding: '10px 20px 0' }}>
          <div style={{
            background: 'rgba(255,209,102,0.1)', border: '1px solid rgba(255,209,102,0.25)',
            borderRadius: 10, padding: '8px 12px',
            fontSize: 12, color: '#FFD166',
          }}>
            ⚠️ Tokens expire in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''} — <Link href="/app/wallet" style={{ color: '#FFD166', fontWeight: 500 }}>top up</Link>
          </div>
        </div>
      )}

      {/* Active session banner */}
      {activeSession && activeVenueName && (
        <div style={{ padding: '12px 20px 0' }}>
          <Link href="/app/session" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(57,217,138,0.12), rgba(108,99,255,0.08))',
              border: '1px solid rgba(57,217,138,0.3)',
              borderRadius: 14, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#39D98A', boxShadow: '0 0 8px #39D98A', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#39D98A' }}>
                  Active session — {activeVenueName}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Tap to show Exit QR</div>
              </div>
              <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>›</div>
            </div>
          </Link>
        </div>
      )}

      {/* Upcoming booking preview */}
      {upcomingBooking && !activeSession && (
        <div style={{ padding: '12px 20px 0' }}>
          <Link href={`/app/booking/${upcomingBooking.id}`} style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)',
              borderRadius: 14, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                  {upcomingBooking.venues?.name}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  {upcomingBooking.venue_slots?.slot_date} · {upcomingBooking.venue_slots?.start_time?.slice(0, 5)}
                </div>
              </div>
              <span style={{ fontSize: 12, color: '#6C63FF', fontWeight: 500 }}>View ›</span>
            </div>
          </Link>
        </div>
      )}

      {/* Peak/off-peak indicator — suppressed on first render to avoid hydration mismatch */}
      <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: peak ? '#FF6B6B' : '#39D98A',
          boxShadow: `0 0 6px ${peak ? '#FF6B6B' : '#39D98A'}`,
        }} />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
          {peak ? 'Peak hours — 1.5× rate' : 'Off-peak — standard rate'}
        </span>
      </div>

      {/* Venue cards */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>Nearby venues</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {venues.map((v: any) => {
            const cost = tokenCost(v.tier, peak);
            return (
              <Link key={v.id} href={`/app/venue/${v.id}`} style={{ textDecoration: 'none' }}>
                <div className="card-enter" style={{
                  background: 'var(--color-card-dark)',
                  borderRadius: 14, padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 3 }}>{v.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        {v.city} · {v.opening_time?.slice(0, 5)}–{v.closing_time?.slice(0, 5)}
                      </div>
                    </div>
                    <TierBadge tier={v.tier} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 500, color: peak ? '#FF6B6B' : '#39D98A' }}>
                        {cost} tokens
                      </span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginLeft: 6 }}>
                        {peak ? 'peak rate' : 'off-peak rate'}
                      </span>
                    </div>
                    <div style={{
                      background: '#6C63FF', color: '#fff', fontSize: 12,
                      padding: '5px 14px', borderRadius: 20, fontWeight: 500,
                    }}>
                      Book
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Browse by category */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>Browse by category</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['Gym', 'CrossFit', 'Yoga', 'Swimming', 'Zumba'].map(cat => (
            <Link key={cat} href={`/app/explore?category=${cat.toLowerCase()}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--color-card-dark)',
                borderRadius: 20, padding: '7px 14px',
                fontSize: 13, color: 'rgba(255,255,255,0.7)',
                border: '0.5px solid rgba(255,255,255,0.08)',
              }}>
                {cat}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ padding: '24px 20px 0' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>How it works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { n: '1', text: 'Book a slot at any venue', sub: 'No tokens deducted yet' },
            { n: '2', text: 'Show Entry QR at the door', sub: 'Staff scans, session starts' },
            { n: '3', text: 'Work out', sub: 'Tokens deducted only at exit' },
            { n: '4', text: 'Show Exit QR when leaving', sub: 'Session closes, tokens deducted' },
          ].map(item => (
            <div key={item.n} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '10px 12px', background: 'var(--color-card-dark)', borderRadius: 10,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(108,99,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, color: '#6C63FF', flexShrink: 0,
              }}>
                {item.n}
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{item.text}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
