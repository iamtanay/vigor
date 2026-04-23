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
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function sessionDuration(entry: string | null, exit: string | null): string {
  if (!entry || !exit) return '—';
  const mins = Math.round((new Date(exit).getTime() - new Date(entry).getTime()) / 60000);
  if (mins < 1) return '<1m';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface Props {
  sessions: any[];
  upcomingBookings: any[];
  tokenBalance: number;
  activeSession?: any | null;
}

export default function ActivityScreen({ sessions, upcomingBookings, tokenBalance, activeSession }: Props) {
  const [tab, setTab] = useState<TabType>(upcomingBookings.length > 0 ? 'upcoming' : 'history');

  // venues can be a nested object from the server query
  const activeVenueName = activeSession?.venues?.name ?? null;

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 16 }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>
          Your activity
        </div>
        <TokenChip balance={tokenBalance} />
      </div>

      {/* Active session banner */}
      {activeSession && activeVenueName && (
        <div style={{ padding: '0 20px 16px' }}>
          <Link href="/app/session" style={{ textDecoration: 'none', display: 'block' }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(57,217,138,0.15), rgba(108,99,255,0.1))',
              border: '1px solid rgba(57,217,138,0.3)',
              borderRadius: 14, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#39D98A', boxShadow: '0 0 8px #39D98A', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#39D98A' }}>
                  Active session at {activeVenueName}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                  Tap to show Exit QR
                </div>
              </div>
              <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }}>›</div>
            </div>
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: 8 }}>
        {(['upcoming', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: tab === t ? '#6C63FF' : 'var(--color-card-dark)',
            color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)',
            fontSize: 13, fontWeight: 500, textTransform: 'capitalize',
          }}>
            {t}
            {t === 'upcoming' && upcomingBookings.length > 0 && (
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 600,
                background: tab === t ? 'rgba(255,255,255,0.25)' : 'rgba(108,99,255,0.3)',
                color: tab === t ? '#fff' : '#6C63FF',
                padding: '1px 6px', borderRadius: 8,
              }}>
                {upcomingBookings.length}
              </span>
            )}
          </button>
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
              {upcomingBookings.map((b: any) => {
                const slot = b.venue_slots;
                const venue = b.venues;
                const slotDt = slot ? new Date(`${slot.slot_date}T${slot.start_time}+05:30`) : null;

                // Entry window: 30 min before to 15 min after slot start
                const now = new Date();
                const windowOpen = slotDt ? new Date(slotDt.getTime() - 30 * 60 * 1000) : null;
                const windowClose = slotDt ? new Date(slotDt.getTime() + 15 * 60 * 1000) : null;
                const inEntryWindow = slotDt && windowOpen && windowClose
                  ? now >= windowOpen && now <= windowClose
                  : false;

                const minsUntil = slotDt ? Math.round((slotDt.getTime() - now.getTime()) / 60000) : null;

                return (
                  <Link key={b.id} href={`/app/booking/${b.id}`} style={{ textDecoration: 'none' }}>
                    <div className="card-enter" style={{
                      background: 'var(--color-card-dark)',
                      borderRadius: 14, padding: '14px 16px',
                      border: inEntryWindow ? '1px solid rgba(57,217,138,0.3)' : '1px solid transparent',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                          <div style={{ fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 3 }}>
                            {venue?.name ?? '—'}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                            {slot ? formatDateShort(slot.slot_date) : '—'} · {slot?.start_time?.slice(0, 5)} – {slot?.end_time?.slice(0, 5)}
                          </div>
                        </div>
                        <TierBadge tier={venue?.tier} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 500,
                          color: '#6C63FF',
                          background: 'rgba(108,99,255,0.12)',
                          padding: '3px 10px', borderRadius: 10,
                        }}>
                          confirmed
                        </span>
                        {inEntryWindow ? (
                          <span style={{ fontSize: 11, color: '#39D98A', fontWeight: 500 }}>
                            📱 Entry QR ready
                          </span>
                        ) : minsUntil != null && minsUntil > 0 ? (
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                            in {minsUntil < 60 ? `${minsUntil}m` : `${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m`}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div style={{ padding: '0 20px' }}>
          {sessions.length === 0 ? (
            <EmptyState
              icon="🏋️"
              title="No sessions yet"
              sub="Your workout history will appear here after your first session"
              href="/app/explore"
              cta="Book a session"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map((s: any) => {
                const venue = s.venues;
                const isAutoClose = s.status === 'auto_closed';

                return (
                  <div key={s.id} className="card-enter" style={{
                    background: 'var(--color-card-dark)',
                    borderRadius: 14, padding: '14px 16px',
                    borderLeft: `3px solid ${isAutoClose ? '#FFD166' : '#39D98A'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500, color: '#fff', marginBottom: 3 }}>
                          {venue?.name ?? '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          {formatDateTime(s.entry_scanned_at)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#FF6B6B' }}>
                          −{s.tokens_deducted ?? '?'} tokens
                        </div>
                        {isAutoClose && (
                          <div style={{ fontSize: 10, color: '#FFD166', marginTop: 2 }}>auto-closed</div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                        Duration: <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                          {sessionDuration(s.entry_scanned_at, s.exit_scanned_at || s.auto_closed_at)}
                        </span>
                      </div>
                      {venue?.tier && <TierBadge tier={venue.tier} />}
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

function EmptyState({ icon, title, sub, href, cta }: { icon: string; title: string; sub: string; href: string; cta: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 44, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, lineHeight: 1.6 }}>{sub}</div>
      <Link href={href} style={{
        background: '#6C63FF', color: '#fff', textDecoration: 'none',
        padding: '12px 24px', borderRadius: 24, fontSize: 14, fontWeight: 500,
      }}>{cta}</Link>
    </div>
  );
}
