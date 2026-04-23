'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import TokenChip from '@/components/TokenChip';
import TierBadge from '@/components/TierBadge';

declare const QRCode: any;

interface ActiveSession {
  id: string;
  venue_id: string;
  entry_scanned_at: string;
  status: string;
  venues: { name: string; tier: string; address: string };
  bookings: { id: string; venue_slots: { slot_date: string; start_time: string; end_time: string } } | null;
}

interface Props {
  initialSession: ActiveSession | null;
  userId: string;
  initialBookingId?: string | null;
}

type ViewMode = 'loading' | 'no-session' | 'entry-qr' | 'active-session' | 'session-summary';

interface SessionSummary {
  venueName: string;
  durationMins: number;
  tokensDeducted: number;
  isPeak: boolean;
  newBalance: number;
  entryAt: string;
  exitAt: string;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatDuration(mins: number) {
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatSlotDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (d.getTime() === today.getTime()) return 'Today';
  if (d.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── QR Display using qrserver.com free API ────────────────────────────────────
function QRDisplay({ value, size = 220 }: { value: string; size?: number }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [value]);

  const src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=1A1A2E&margin=2&ecc=M`;

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      {!loaded && !error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f8f8f8', borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, color: '#6C63FF' }}>Loading QR…</div>
        </div>
      )}
      {error && (
        <div style={{
          width: size, height: size,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8,
          background: '#1A1A2E', borderRadius: 12,
        }}>
          <div style={{ fontSize: 24 }}>📵</div>
          <div style={{ fontSize: 11, color: '#FF6B6B', textAlign: 'center' }}>
            QR unavailable<br />
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>Check internet</span>
          </div>
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        width={size}
        height={size}
        alt="QR Code"
        style={{
          borderRadius: 12,
          display: loaded ? 'block' : 'none',
        }}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

// ── Countdown ring ─────────────────────────────────────────────────────────────
function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, seconds / total));
  const dash = circ * pct;
  const color = seconds <= 10 ? '#FF6B6B' : seconds <= 20 ? '#FFD166' : '#39D98A';

  return (
    <svg width={52} height={52} viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={3} />
      <circle
        cx={26} cy={26} r={r}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s linear' }}
      />
      <text
        x={26} y={30}
        textAnchor="middle"
        fontSize={13}
        fontWeight={600}
        fill={color}
        style={{ transform: 'rotate(90deg)', transformOrigin: '26px 26px' }}
      >
        {seconds}
      </text>
    </svg>
  );
}

export default function ActiveSessionScreen({ initialSession, userId, initialBookingId }: Props) {
  const router = useRouter();

  const [session, setSession] = useState<ActiveSession | null>(initialSession);
  const [mode, setMode] = useState<ViewMode>(initialSession ? 'active-session' : 'loading');

  // Entry QR state
  const [entryBookingId, setEntryBookingId] = useState<string | null>(null);
  const [entryQR, setEntryQR] = useState<string | null>(null);
  const [entryQRExpiry, setEntryQRExpiry] = useState<Date | null>(null);
  const [entrySecondsLeft, setEntrySecondsLeft] = useState(0);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [entryVenueName, setEntryVenueName] = useState<string>('');
  const [entrySlotInfo, setEntrySlotInfo] = useState<string>('');
  const [entryMinutesUntil, setEntryMinutesUntil] = useState<number>(0);

  // Exit QR state
  const [exitQR, setExitQR] = useState<string | null>(null);
  const [exitCountdown, setExitCountdown] = useState(60);
  const [exitLoading, setExitLoading] = useState(false);
  const exitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Session timer
  const [sessionMins, setSessionMins] = useState(0);
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  // Summary after exit
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  // ── Load token balance
  useEffect(() => {
    fetch('/api/wallet').then(r => r.json()).then(d => setTokenBalance(d.available ?? 0));
  }, []);

  // ── Session timer
  useEffect(() => {
    if (!session?.entry_scanned_at) return;
    const tick = () => {
      const mins = Math.round((Date.now() - new Date(session.entry_scanned_at).getTime()) / 60000);
      setSessionMins(mins);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [session]);

  // ── Entry QR countdown
  useEffect(() => {
    if (!entryQRExpiry) return;
    const tick = () => {
      const secs = Math.max(0, Math.round((entryQRExpiry.getTime() - Date.now()) / 1000));
      setEntrySecondsLeft(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [entryQRExpiry]);

  // ── Check for active session on mount (handles case where entry was just scanned)
  useEffect(() => {
    if (initialSession) {
      // Already have session — no need to check
      setMode('active-session');
      return;
    }

    // Check if there's now an active session (may have been scanned since page load)
    fetch('/api/sessions/active')
      .then(r => r.json())
      .then(data => {
        if (data.session) {
          // There's an active session — fetch full details and show exit QR
          refreshSession(data.session.id);
        } else if (initialBookingId) {
          // Came here from booking confirm page — auto-generate entry QR
          generateEntryQR(initialBookingId);
        } else {
          setMode('no-session');
        }
      })
      .catch(() => {
        if (initialBookingId) {
          generateEntryQR(initialBookingId);
        } else {
          setMode('no-session');
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch full session details (when we only have session ID from active API)
  async function refreshSession(sessionId: string) {
    try {
      const res = await fetch('/api/sessions/active');
      if (!res.ok) return;
      const data = await res.json();
      if (data.session) {
        // Construct minimal session object for exit QR mode
        setSession({
          id: data.session.id,
          venue_id: data.session.venueId,
          entry_scanned_at: data.session.entryScannedAt,
          status: 'open',
          venues: {
            name: data.session.venueName,
            tier: data.session.venueTier,
            address: data.session.venueAddress,
          },
          bookings: null,
        });
        setMode('active-session');
      } else {
        setMode('no-session');
      }
    } catch {
      setMode('no-session');
    }
  }

  // ── Poll for session closure while showing exit QR
  const pollForSessionClosure = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/sessions/active');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.session) {
        // Session closed — fetch summary
        const summaryRes = await fetch(`/api/sessions/summary?sessionId=${session.id}`);
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
          setMode('session-summary');
          if (exitIntervalRef.current) clearInterval(exitIntervalRef.current);
        } else {
          setSession(null);
          setMode('no-session');
        }
      }
    } catch { /* ignore */ }
  }, [session]);

  // ── Fetch exit QR
  const fetchExitQR = useCallback(async () => {
    if (!session) return;
    setExitLoading(true);
    try {
      const res = await fetch('/api/sessions/generate-exit-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 404 || err.error?.includes('closed') || err.error?.includes('No open session')) {
          await pollForSessionClosure();
          return;
        }
        return;
      }
      const data = await res.json();
      setExitQR(data.qrString);
      setExitCountdown(60);
    } finally {
      setExitLoading(false);
    }
  }, [session, pollForSessionClosure]);

  // ── Setup exit QR auto-refresh when mode = active-session
  useEffect(() => {
    if (mode !== 'active-session' || !session) return;

    fetchExitQR();

    exitIntervalRef.current = setInterval(() => {
      setExitCountdown(prev => {
        if (prev <= 1) {
          fetchExitQR();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    // Poll every 10s for closure
    const pollInterval = setInterval(pollForSessionClosure, 10000);

    return () => {
      if (exitIntervalRef.current) clearInterval(exitIntervalRef.current);
      clearInterval(pollInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, session?.id]);

  // ── Generate entry QR
  async function generateEntryQR(bookingId: string) {
    setEntryLoading(true);
    setEntryError(null);
    try {
      const res = await fetch('/api/sessions/generate-entry-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEntryError(data.error || 'Failed to generate QR');
        setMode('no-session');
        return;
      }
      setEntryQR(data.qrString);
      setEntryQRExpiry(new Date(data.expiresAt));
      setEntryBookingId(bookingId);
      setEntryVenueName(data.venueName ?? '');
      setEntryMinutesUntil(data.minutesUntilSlot ?? 0);
      if (data.minutesUntilSlot != null) {
        const slotDt = new Date(data.slotStart);
        setEntrySlotInfo(`${formatSlotDate(slotDt.toISOString().slice(0, 10))} · ${slotDt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`);
      }
      setMode('entry-qr');
    } finally {
      setEntryLoading(false);
    }
  }

  // ── Loading state
  if (mode === 'loading') {
    return (
      <div className="mobile-viewport" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading session…</div>
      </div>
    );
  }

  // ── No active session view
  if (mode === 'no-session') {
    return (
      <div className="mobile-viewport" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🏋️</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: '#fff', marginBottom: 8 }}>
          No active session
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32, lineHeight: 1.6 }}>
          Book a slot and show your entry QR at the gym to start a session
        </div>

        {entryError && (
          <div style={{
            background: 'rgba(255,107,107,0.12)',
            border: '1px solid rgba(255,107,107,0.25)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: '#FF6B6B',
            width: '100%',
          }}>
            {entryError}
          </div>
        )}

        <EntryQRLauncher onGenerate={generateEntryQR} loading={entryLoading} error={null} />

        <button
          onClick={() => router.push('/app/explore')}
          style={{
            marginTop: 12,
            background: 'transparent',
            border: '1px solid rgba(108,99,255,0.3)',
            color: '#6C63FF',
            borderRadius: 24,
            padding: '12px 28px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Browse venues
        </button>
      </div>
    );
  }

  // ── Entry QR view
  if (mode === 'entry-qr' && entryQR) {
    const isFutureSlot = entryMinutesUntil > 15;
    return (
      <div className="mobile-viewport page-slide-in" style={{ minHeight: '100dvh', padding: '20px', display: 'flex', flexDirection: 'column' }}>
        <button onClick={() => setMode('no-session')} style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 24, alignSelf: 'flex-start' }}>
          ‹ Back
        </button>

        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
            {entryVenueName}
          </div>
          <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>Entry QR Code</div>
          {entrySlotInfo && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
              {entrySlotInfo}
            </div>
          )}
        </div>

        {/* Future slot warning */}
        {isFutureSlot && (
          <div style={{
            background: 'rgba(255,209,102,0.1)',
            border: '1px solid rgba(255,209,102,0.3)',
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 16 }}>⏰</span>
            <div style={{ fontSize: 12, color: '#FFD166', lineHeight: 1.5 }}>
              Your slot starts in ~{entryMinutesUntil} min. Show this QR at the gym when you arrive — it becomes scannable 15 min before slot start.
            </div>
          </div>
        )}

        {/* QR Container */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          padding: 16,
          margin: '0 auto',
          boxShadow: '0 0 40px rgba(108,99,255,0.3)',
        }}>
          {entrySecondsLeft <= 0 && entryQRExpiry ? (
            <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 32 }}>⏱️</div>
              <div style={{ fontSize: 13, color: '#FF6B6B', fontWeight: 500 }}>QR Expired</div>
              <button onClick={() => entryBookingId && generateEntryQR(entryBookingId)}
                style={{ marginTop: 8, background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 20px', fontSize: 13, cursor: 'pointer' }}>
                Regenerate
              </button>
            </div>
          ) : (
            <QRDisplay value={entryQR} size={220} />
          )}
        </div>

        {/* Countdown — only show if expiry is within 15 minutes */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          {!isFutureSlot && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: entrySecondsLeft > 300 ? '#39D98A' : entrySecondsLeft > 60 ? '#FFD166' : '#FF6B6B',
                boxShadow: `0 0 8px ${entrySecondsLeft > 300 ? '#39D98A' : entrySecondsLeft > 60 ? '#FFD166' : '#FF6B6B'}`,
              }} />
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                Valid for <span style={{ color: '#fff', fontWeight: 500 }}>{Math.floor(entrySecondsLeft / 60)}:{pad(entrySecondsLeft % 60)}</span>
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Single-use · Show this to staff at the gym entrance
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          marginTop: 28, background: 'var(--color-card-dark)',
          borderRadius: 14, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>What happens next</div>
          {[
            { icon: '📱', text: 'Show this QR to the staff or kiosk at entry' },
            { icon: '✅', text: 'Your session starts when they scan it' },
            { icon: '🏋️', text: 'Work out — tokens are not deducted yet' },
            { icon: '📤', text: 'Come back to this screen when leaving to show your Exit QR' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderBottom: i < 3 ? '0.5px solid rgba(255,255,255,0.06)' : 'none' }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Active Session (Exit QR) view
  if (mode === 'active-session' && session) {
    const venue = session.venues;
    const autoCloseWarning = sessionMins > 210;

    return (
      <div className="mobile-viewport page-slide-in" style={{ minHeight: '100dvh', padding: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Active session</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em' }}>{venue.name}</div>
          </div>
          {tokenBalance !== null && <TokenChip balance={tokenBalance} />}
        </div>

        {/* Session info */}
        <div style={{
          background: 'var(--color-card-dark)',
          borderRadius: 16, padding: '14px 16px', marginBottom: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Duration</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: '#39D98A' }}>{formatDuration(sessionMins)}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              Entry at {formatTime(session.entry_scanned_at)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <TierBadge tier={venue.tier as any} />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{venue.address}</div>
          </div>
        </div>

        {/* Auto-close warning */}
        {autoCloseWarning && (
          <div style={{
            background: 'rgba(255,107,107,0.12)',
            border: '1px solid rgba(255,107,107,0.3)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 16,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ fontSize: 12, color: '#FF6B6B', lineHeight: 1.5 }}>
              Session over 3.5 hrs — auto-close in {Math.max(0, 240 - sessionMins)} mins. Please scan out soon.
            </div>
          </div>
        )}

        {/* Exit QR section */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Show this when leaving</div>
          <div style={{ fontSize: 18, fontWeight: 500, color: '#fff' }}>Exit QR Code</div>
        </div>

        {/* QR + countdown */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
          <div style={{
            background: '#fff', borderRadius: 20, padding: 16,
            boxShadow: '0 0 40px rgba(57,217,138,0.25)',
          }}>
            {exitLoading && !exitQR ? (
              <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 13, color: '#6C63FF' }}>Generating…</div>
              </div>
            ) : exitQR ? (
              <QRDisplay value={exitQR} size={220} />
            ) : (
              <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)' }}>Loading…</div>
              </div>
            )}
          </div>

          {/* Countdown badge */}
          <div style={{
            position: 'absolute', top: -10, right: '50%',
            transform: 'translateX(120px)',
            background: 'var(--color-deep-space)',
            borderRadius: '50%', padding: 2,
            border: '2px solid var(--color-card-dark)',
          }}>
            <CountdownRing seconds={exitCountdown} total={60} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Refreshes every 60 seconds · Scanned QR instantly invalid
          </div>
        </div>

        {/* Token cost preview */}
        <TokenCostPreview venueTier={venue.tier} />

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            Session #{session.id.slice(0, 8).toUpperCase()}
          </div>
        </div>
      </div>
    );
  }

  // ── Session Summary (after exit scan)
  if (mode === 'session-summary' && summary) {
    const durationStr = formatDuration(summary.durationMins);
    return (
      <div className="mobile-viewport page-slide-in" style={{ minHeight: '100dvh', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(57,217,138,0.15)',
          border: '2px solid rgba(57,217,138,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
          marginTop: 40, marginBottom: 24,
        }}>✓</div>

        <div style={{ fontSize: 22, fontWeight: 500, color: '#fff', marginBottom: 6, textAlign: 'center' }}>
          Great workout!
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32, textAlign: 'center' }}>
          {summary.venueName}
        </div>

        <div style={{ background: 'var(--color-card-dark)', borderRadius: 16, padding: 20, width: '100%', marginBottom: 16 }}>
          {[
            { label: 'Duration', value: durationStr, color: '#fff' },
            { label: 'Tokens deducted', value: `${summary.tokensDeducted} tokens`, color: '#FF6B6B' },
            { label: 'Rate', value: summary.isPeak ? '🔴 Peak (1.5×)' : '🟢 Off-peak (1.0×)', color: summary.isPeak ? '#FF6B6B' : '#39D98A' },
            { label: 'New balance', value: `${summary.newBalance} tokens`, color: '#39D98A' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < 3 ? '0.5px solid rgba(255,255,255,0.07)' : 'none' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>

        <button onClick={() => router.push('/app/home')} style={{
          background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 24,
          padding: '14px', width: '100%', fontSize: 15, fontWeight: 500, cursor: 'pointer', marginBottom: 12,
        }}>Back to home</button>
        <button onClick={() => router.push('/app/explore')} style={{
          background: 'transparent', color: '#6C63FF',
          border: '1px solid rgba(108,99,255,0.3)',
          borderRadius: 24, padding: '14px', width: '100%', fontSize: 15, fontWeight: 500, cursor: 'pointer',
        }}>Book another session</button>
      </div>
    );
  }

  return null;
}

// ── Sub-component: Entry QR launcher — shows ALL upcoming bookings
function EntryQRLauncher({
  onGenerate,
  loading,
  error,
}: {
  onGenerate: (bookingId: string) => void;
  loading: boolean;
  error: string | null;
}) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    fetch('/api/sessions/upcoming-bookings')
      .then(r => r.json())
      .then(d => setBookings(d.bookings || []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  if (fetching) {
    return (
      <div style={{ width: '100%', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Loading bookings…</div>
      </div>
    );
  }

  if (bookings.length === 0) return null;

  return (
    <div style={{ width: '100%', marginBottom: 8 }}>
      {error && (
        <div style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 8 }}>{error}</div>
      )}
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8, textAlign: 'left' }}>
        Your upcoming bookings:
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        {bookings.map((b: any) => {
          const slot = b.venue_slots;
          const venue = b.venues;
          const slotDt = slot ? new Date(`${slot.slot_date}T${slot.start_time}+05:30`) : null;
          const isReady = b.inEntryWindow;
          const minsUntil = b.minutesUntil;

          return (
            <button
              key={b.id}
              onClick={() => onGenerate(b.id)}
              disabled={loading}
              style={{
                width: '100%',
                background: isReady ? '#6C63FF' : 'var(--color-card-dark)',
                border: isReady ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14,
                padding: '14px 16px',
                cursor: loading ? 'not-allowed' : 'pointer',
                textAlign: 'left',
                opacity: loading ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 2 }}>
                    {loading ? 'Generating QR…' : `Get Entry QR — ${venue?.name ?? ''}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                    {slot ? `${formatSlotDate(slot.slot_date)} · ${slot.start_time?.slice(0, 5)}` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                  {isReady ? (
                    <span style={{ fontSize: 11, color: '#fff', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 8 }}>
                      Ready ✓
                    </span>
                  ) : minsUntil != null && minsUntil > 0 ? (
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      in {minsUntil < 60 ? `${minsUntil}m` : `${Math.floor(minsUntil / 60)}h`}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-component: Token cost preview based on current time
function TokenCostPreview({ venueTier }: { venueTier: string }) {
  const RATES: Record<string, number> = { bronze: 6, silver: 10, gold: 16 };
  const base = RATES[venueTier] ?? 6;
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const istHour = (utcHour + 5 + (utcMin >= 30 ? 1 : 0)) % 24;
  const isPeak = (istHour >= 6 && istHour < 9) || (istHour >= 17 && istHour < 21);
  const cost = isPeak ? Math.ceil(base * 1.5) : base;

  return (
    <div style={{
      background: 'var(--color-card-dark)', borderRadius: 12, padding: '12px 14px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Est. token cost on exit</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: isPeak ? '#FF6B6B' : '#39D98A', marginTop: 2 }}>
          {cost} tokens
        </div>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 20,
        background: isPeak ? 'rgba(255,107,107,0.15)' : 'rgba(57,217,138,0.15)',
        color: isPeak ? '#FF6B6B' : '#39D98A',
        border: `1px solid ${isPeak ? 'rgba(255,107,107,0.3)' : 'rgba(57,217,138,0.3)'}`,
      }}>
        {isPeak ? '🔴 Peak' : '🟢 Off-peak'}
      </div>
    </div>
  );
}
