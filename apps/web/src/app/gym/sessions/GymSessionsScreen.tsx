'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import VigorLogo from '@/components/VigorLogo';

interface SessionRow {
  id: string;
  status: string;
  entry_scanned_at: string | null;
  exit_scanned_at: string | null;
  auto_closed_at: string | null;
  tokens_deducted: number | null;
  duration_seconds: number | null;
  scan_method_entry: string | null;
  scan_method_exit: string | null;
  booking: {
    id: string;
    user: { name: string | null; phone: string | null } | null;
  } | null;
}

type RangeOption = 'today' | 'week' | 'month' | 'all';
type StatusOption = 'all' | 'open' | 'closed' | 'auto_closed';

const RANGE_LABELS: Record<RangeOption, string> = {
  today: 'Today',
  week: '7 days',
  month: '30 days',
  all: 'All time',
};

const STATUS_LABELS: Record<StatusOption, string> = {
  all: 'All',
  open: 'Active',
  closed: 'Closed',
  auto_closed: 'Auto-closed',
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return 'Today';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatDuration(sec: number | null) {
  if (sec === null) return '—';
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
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

export default function GymSessionsScreen() {
  const [sessions, setSessions]   = useState<SessionRow[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [range, setRange]         = useState<RangeOption>('today');
  const [status, setStatus]       = useState<StatusOption>('all');
  const [page, setPage]           = useState(1);
  const LIMIT = 30;

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range, status, page: String(page), limit: String(LIMIT) });
      const res = await fetch(`/api/gym/sessions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data.sessions ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [range, status, page]);

  useEffect(() => {
    setPage(1);
  }, [range, status]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

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
        <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>Session History</div>
        <div style={{ width: 60 }} />
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px' }}>

        {/* Range filter pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {(Object.keys(RANGE_LABELS) as RangeOption[]).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                flexShrink: 0,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: range === r ? '#6C63FF' : 'rgba(255,255,255,0.07)',
                color: range === r ? '#fff' : 'rgba(255,255,255,0.5)',
                transition: 'all 0.15s',
              }}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>

        {/* Status filter pills */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
          {(Object.keys(STATUS_LABELS) as StatusOption[]).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                flexShrink: 0,
                padding: '5px 12px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 500,
                border: `1px solid ${status === s ? 'transparent' : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer',
                background: status === s ? 'rgba(108,99,255,0.2)' : 'transparent',
                color: status === s ? '#6C63FF' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Summary row */}
        <div style={{
          background: 'var(--color-card-dark)',
          borderRadius: 12, padding: '10px 14px',
          marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            {loading ? 'Loading…' : `${total} session${total !== 1 ? 's' : ''}`}
          </div>
          <button
            onClick={fetchSessions}
            style={{
              fontSize: 11, color: '#6C63FF', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
            }}
          >
            ↻ Refresh
          </button>
        </div>

        {/* Session list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{
                height: 72, borderRadius: 12,
                background: 'rgba(255,255,255,0.04)',
                animation: 'pulse 1.5s infinite',
              }} />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 20px',
            color: 'rgba(255,255,255,0.25)', fontSize: 14,
          }}>
            No sessions found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => {
              const memberName = s.booking?.user?.name ?? s.booking?.user?.phone ?? 'Unknown';
              const isOpen     = s.status === 'open';
              const isAuto     = s.status === 'auto_closed';

              const statusColor = isOpen ? '#39D98A' : isAuto ? '#FFD166' : 'rgba(255,255,255,0.35)';
              const statusLabel = isOpen ? 'ACTIVE' : isAuto ? 'AUTO' : 'DONE';

              return (
                <div
                  key={s.id}
                  className="card-enter"
                  style={{
                    background: 'var(--color-card-dark)',
                    borderRadius: 14,
                    padding: '12px 14px',
                    border: isOpen ? '1px solid rgba(57,217,138,0.2)' : '1px solid transparent',
                  }}
                >
                  {/* Row 1: status + session id + tokens */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
                        padding: '2px 7px', borderRadius: 5,
                        background: `${statusColor}18`, color: statusColor,
                      }}>
                        {statusLabel}
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                        #{s.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {!isOpen && s.tokens_deducted != null && (
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#FFD166' }}>
                          {s.tokens_deducted}t
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: member + times */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{memberName}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                        {formatDate(s.entry_scanned_at)} · {formatTime(s.entry_scanned_at)}
                        {!isOpen && ` → ${formatTime(s.exit_scanned_at ?? s.auto_closed_at)}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                        {isOpen
                          ? formatDuration(Math.round((Date.now() - new Date(s.entry_scanned_at!).getTime()) / 1000))
                          : formatDuration(s.duration_seconds)}
                      </div>
                      {s.scan_method_entry && (
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>
                          {s.scan_method_entry}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 24 }}>
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13,
                background: page <= 1 ? 'rgba(255,255,255,0.04)' : 'rgba(108,99,255,0.2)',
                color: page <= 1 ? 'rgba(255,255,255,0.2)' : '#6C63FF',
                border: 'none', cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '8px 18px', borderRadius: 10, fontSize: 13,
                background: page >= totalPages ? 'rgba(255,255,255,0.04)' : 'rgba(108,99,255,0.2)',
                color: page >= totalPages ? 'rgba(255,255,255,0.2)' : '#6C63FF',
                border: 'none', cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(26,26,46,0.96)', backdropFilter: 'blur(16px)',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))', zIndex: 50,
      }}>
        <NavLink href="/gym"             icon="🏠" label="Dashboard" />
        <NavLink href="/gym/scan"        icon="📷" label="Scan" />
        <NavLink href="/gym/sessions"    icon="📋" label="Sessions" active />
        <NavLink href="/gym/settlements" icon="💳" label="Settle" />
        <NavLink href="/gym/venue"       icon="⚙️" label="Venue" />
      </nav>
    </div>
  );
}
