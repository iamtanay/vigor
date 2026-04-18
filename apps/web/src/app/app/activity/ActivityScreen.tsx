'use client';

import { useState } from 'react';
import Link from 'next/link';
import TierBadge from '@/components/TierBadge';
import TokenChip from '@/components/TokenChip';

type TabType = 'upcoming' | 'history';

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function formatDateShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function sessionDuration(entry: string | null, exit: string | null): string {
  if (!entry || !exit) return '—';
  const mins = Math.round((new Date(exit).getTime() - new Date(entry).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface Props {
  sessions: any[];
  upcomingBookings: any[];
  tokenBalance: number;
}

export default function ActivityScreen({ sessions, upcomingBookings, tokenBalance }: Props) {
  const [tab, setTab] = useState<TabType>(upcomingBookings.length > 0 ? 'upcoming' : 'history');

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>
          Your activity
        </div>
        <TokenChip balance={tokenBalance} />
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
        {(['upcoming', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: tab === t ? '#6C63FF' : 'var(--color-card-dark)',
            color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)',
            fontSize: 13, fontWeight: 500, textTransform: 'capitalize',
          }}>{t}</button>
        ))}
      </div>

      {/* Upcoming bookings */}
      {tab === 'upcoming' && (
        <div style={{ padding: '0 20px' }}>
          {upcomingBookings.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No upcoming bookings"
              sub="Browse venues and book a slot to get started"
              href="/app/explore"
              cta="Explore venues"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingBookings.map((b: any, i: number) => {
                const slot = b.venue_slots;
                const venue = b.venues;
                return (
                  <Link key={b.id} href={`/app/booking/${b.id}`} style={{ textDecoration: 'none' }} className="card-enter">
                    <div style={{
                      background: 'var(--color-card-dark)',
                      borderRadius: 14,
                      border: '0.5px solid rgba(255,255,255,0.06)',
                      padding: '14px 16px',
                      animationDelay: `${i * 50}ms`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 2 }}>
                            {venue?.name}
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                            {venue?.city}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          {venue?.tier && <TierBadge tier={venue.tier} />}
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                            #{b.id.slice(0, 6).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 10, borderTop: '0.5px solid rgba(255,255,255,0.06)' }}>
                        <div style={{
                          background: 'rgba(108,99,255,0.1)', borderRadius: 8, padding: '6px 12px',
                          fontSize: 13, fontWeight: 600, color: '#A09BFF',
                        }}>
                          {slot ? formatDateShort(slot.slot_date) : '—'}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                          {slot?.start_time?.slice(0,5)} – {slot?.end_time?.slice(0,5)}
                        </div>
                        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>›</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Session history */}
      {tab === 'history' && (
        <div style={{ padding: '0 20px' }}>
          {sessions.length === 0 ? (
            <EmptyState
              icon="🏋️"
              title="No sessions yet"
              sub="Your workout history will appear here after your first check-in"
              href="/app/explore"
              cta="Find a gym"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map((s: any, i: number) => {
                const venue = s.venues;
                const booking = s.bookings;
                const slot = booking?.venue_slots;
                const isOpen = s.status === 'open';
                const isAutoClosed = s.status === 'auto_closed';

                return (
                  <div key={s.id} className="card-enter" style={{
                    background: 'var(--color-card-dark)',
                    borderRadius: 14,
                    border: `0.5px solid ${isOpen ? 'rgba(57,217,138,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    padding: '14px 16px',
                    animationDelay: `${i * 40}ms`,
                  }}>
                    {/* Top row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>{venue?.name}</div>
                          {isOpen && (
                            <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase',
                              background: 'rgba(57,217,138,0.15)', color: '#39D98A',
                              border: '1px solid rgba(57,217,138,0.3)', padding: '2px 6px', borderRadius: 6,
                            }}>Live</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                          {formatDateTime(s.entry_scanned_at ?? s.created_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        {venue?.tier && <TierBadge tier={venue.tier} />}
                        {slot?.slot_date && (
                          <span style={{
                            fontSize: 10, color: 'rgba(255,255,255,0.3)',
                            background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 6,
                          }}>
                            {formatDateShort(slot.slot_date)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{
                      display: 'flex', gap: 12, paddingTop: 10,
                      borderTop: '0.5px solid rgba(255,255,255,0.06)',
                    }}>
                      <StatChip
                        label="Duration"
                        value={isOpen ? 'In progress' : sessionDuration(s.entry_scanned_at, s.exit_scanned_at ?? s.auto_closed_at)}
                        color={isOpen ? '#39D98A' : 'rgba(255,255,255,0.6)'}
                      />
                      <StatChip
                        label="Tokens"
                        value={s.tokens_deducted != null ? `${s.tokens_deducted} used` : isOpen ? 'Pending' : '—'}
                        color={s.tokens_deducted ? '#FF6B6B' : 'rgba(255,255,255,0.4)'}
                      />
                      {isAutoClosed && (
                        <StatChip label="Note" value="Auto-closed" color="#FFD166" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color }}>{value}</div>
    </div>
  );
}

function EmptyState({ icon, title, sub, href, cta }: { icon: string; title: string; sub: string; href: string; cta: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.6 }}>{sub}</div>
      <Link href={href} style={{
        display: 'inline-block', padding: '12px 24px',
        background: '#6C63FF', borderRadius: 12,
        color: '#fff', fontSize: 14, fontWeight: 500, textDecoration: 'none',
      }}>{cta}</Link>
    </div>
  );
}
