'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/browser';
import VigorLogo from '@/components/VigorLogo';
import TierBadge from '@/components/TierBadge';

interface SessionRow {
  id: string;
  status: string;
  entry_scanned_at: string | null;
  exit_scanned_at: string | null;
  tokens_deducted: number | null;
}

interface Venue {
  id: string;
  name: string;
  tier: string;
  address: string;
  opening_time: string;
  closing_time: string;
  avg_rating: number;
  total_ratings: number;
  payout_rate_inr: number;
}

interface Profile {
  id: string;
  name: string | null;
  role: string;
}

interface Props {
  profile: Profile;
  venue: Venue | null;
  initialSessions: SessionRow[];
}

function formatDuration(ms: number) {
  const totalMins = Math.round(ms / 60000);
  if (totalMins < 60) return `${totalMins}m`;
  return `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
}

function formatPaise(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '8px 12px',
        borderRadius: 10,
        textDecoration: 'none',
        background: active ? 'rgba(108,99,255,0.12)' : 'transparent',
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: '0.04em',
          color: active ? '#6C63FF' : 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </Link>
  );
}

export default function GymDashboardClient({ profile, venue, initialSessions }: Props) {
  const [sessions, setSessions] = useState<SessionRow[]>(initialSessions);
  const [isConnected, setIsConnected] = useState(false);
  const supabase = createClient();

  // Compute derived stats
  const openSessions   = sessions.filter(s => s.status === 'open');
  const closedSessions = sessions.filter(s => s.status !== 'open');
  const tokensToday    = closedSessions.reduce((sum, s) => sum + (s.tokens_deducted ?? 0), 0);
  const estimatedPayout = venue
    ? tokensToday * venue.payout_rate_inr
    : 0;

  const refreshSessions = useCallback(async () => {
    if (!venue) return;
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('sessions')
      .select('id, status, entry_scanned_at, exit_scanned_at, tokens_deducted')
      .eq('venue_id', venue.id)
      .gte('entry_scanned_at', `${today}T00:00:00`)
      .order('entry_scanned_at', { ascending: false });
    if (data) setSessions(data);
  }, [venue, supabase]);

  // Supabase Realtime subscription for live occupancy
  useEffect(() => {
    if (!venue) return;

    const channel = supabase
      .channel(`gym-sessions-${venue.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `venue_id=eq.${venue.id}`,
        },
        () => {
          // Refetch on any session change (insert or update)
          refreshSessions();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venue, supabase, refreshSessions]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-deep-space)', fontFamily: 'system-ui', paddingBottom: 80 }}>

      {/* Header */}
      <header style={{
        padding: '16px 20px',
        background: 'rgba(26,26,46,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <VigorLogo height={26} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Realtime status dot */}
          <div
            title={isConnected ? 'Live' : 'Connecting…'}
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: isConnected ? '#39D98A' : '#FFD166',
              boxShadow: isConnected ? '0 0 6px #39D98A' : 'none',
              transition: 'background 0.3s',
            }}
          />
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {profile.name ?? 'Owner'}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {/* Venue card */}
        {venue ? (
          <div style={{
            background: 'var(--color-card-dark)',
            borderRadius: 16, padding: '16px 18px', marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500, color: '#fff', marginBottom: 4 }}>{venue.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{venue.address}</div>
              </div>
              <TierBadge tier={venue.tier as 'bronze' | 'silver' | 'gold'} />
            </div>
            <div style={{ display: 'flex', gap: 20 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Rating</div>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#FFD166' }}>
                  ⭐ {venue.avg_rating.toFixed(1)}
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 400, marginLeft: 4 }}>
                    ({venue.total_ratings})
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Hours</div>
                <div style={{ fontSize: 13, color: '#fff' }}>
                  {venue.opening_time?.slice(0, 5)} – {venue.closing_time?.slice(0, 5)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Payout rate</div>
                <div style={{ fontSize: 13, color: '#39D98A' }}>
                  {formatPaise(venue.payout_rate_inr)}/token
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--color-card-dark)', borderRadius: 16, padding: 20,
            marginBottom: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14,
          }}>
            No active venue linked to this account
          </div>
        )}

        {/* Live stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            {
              label: 'Active now',
              value: openSessions.length,
              color: '#39D98A',
              sub: 'live occupancy',
              icon: '🟢',
            },
            {
              label: 'Sessions today',
              value: sessions.length,
              color: '#6C63FF',
              sub: 'entries recorded',
              icon: '📊',
            },
            {
              label: 'Tokens consumed',
              value: tokensToday,
              color: '#FFD166',
              sub: 'today',
              icon: '🪙',
            },
            {
              label: 'Est. earnings',
              value: formatPaise(estimatedPayout),
              color: '#39D98A',
              sub: 'today',
              icon: '💰',
            },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background: 'var(--color-card-dark)',
                borderRadius: 14,
                padding: '14px 14px',
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 6 }}>{stat.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{stat.label}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          <Link href="/gym/scan" style={{ textDecoration: 'none' }}>
            <div style={{
              background: '#6C63FF', borderRadius: 14, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11,
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>📷</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#fff' }}>Scan QR</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                  Entry and exit scans for members
                </div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.5)', fontSize: 20 }}>›</div>
            </div>
          </Link>
        </div>

        {/* Live active sessions */}
        {openSessions.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#39D98A', boxShadow: '0 0 6px #39D98A' }} />
              Active sessions ({openSessions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {openSessions.map(s => {
                const mins = s.entry_scanned_at
                  ? Math.round((Date.now() - new Date(s.entry_scanned_at).getTime()) / 60000)
                  : 0;
                const isLong = mins > 180;
                return (
                  <div key={s.id} style={{
                    background: 'var(--color-card-dark)',
                    borderRadius: 12, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    border: isLong ? '1px solid rgba(255,107,107,0.3)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#39D98A', boxShadow: '0 0 6px #39D98A' }} />
                      <div style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace' }}>
                        #{s.id.slice(0, 6).toUpperCase()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isLong && (
                        <div style={{ fontSize: 10, color: '#FF6B6B', background: 'rgba(255,107,107,0.1)', borderRadius: 6, padding: '2px 6px' }}>
                          &gt;3h
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: isLong ? '#FFD166' : 'rgba(255,255,255,0.4)' }}>
                        {formatDuration(mins * 60000)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent completed sessions */}
        {closedSessions.length > 0 && (
          <div>
            <div style={{
              fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>Recent completed</span>
              <Link href="/gym/sessions" style={{ color: '#6C63FF', textDecoration: 'none', fontSize: 11 }}>
                View all →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {closedSessions.slice(0, 5).map(s => {
                const entry = s.entry_scanned_at ? new Date(s.entry_scanned_at) : null;
                const exit  = s.exit_scanned_at  ? new Date(s.exit_scanned_at)  : null;
                const durMs = entry && exit ? exit.getTime() - entry.getTime() : null;
                return (
                  <div key={s.id} style={{
                    background: 'var(--color-card-dark)',
                    borderRadius: 12, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        fontSize: 10,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: s.status === 'auto_closed'
                          ? 'rgba(255,209,102,0.1)' : 'rgba(57,217,138,0.1)',
                        color: s.status === 'auto_closed' ? '#FFD166' : '#39D98A',
                        fontWeight: 500,
                      }}>
                        {s.status === 'auto_closed' ? 'AUTO' : 'DONE'}
                      </div>
                      <div style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace' }}>
                        #{s.id.slice(0, 6).toUpperCase()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {durMs && (
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                          {formatDuration(durMs)}
                        </div>
                      )}
                      <div style={{ fontSize: 12, color: '#FFD166', fontWeight: 500 }}>
                        {s.tokens_deducted ?? 0}t
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(26,26,46,0.96)',
        backdropFilter: 'blur(16px)',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
        zIndex: 50,
      }}>
        <NavLink href="/gym"          icon="🏠" label="Dashboard" active />
        <NavLink href="/gym/scan"     icon="📷" label="Scan" />
        <NavLink href="/gym/sessions" icon="📋" label="Sessions" />
        <NavLink href="/gym/settlements" icon="💳" label="Settle" />
        <NavLink href="/gym/venue"    icon="⚙️" label="Venue" />
      </nav>
    </div>
  );
}
