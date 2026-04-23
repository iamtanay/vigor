'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import VigorLogo from '@/components/VigorLogo';
import TokenChip from '@/components/TokenChip';
import TierBadge from '@/components/TierBadge';

// ── Tiny QR code generator using the qrcode library loaded via CDN script tag
// We use a canvas-based approach with the `qrcode` npm package
// imported dynamically so it doesn't bloat server bundle
declare const QRCode: any;

interface ActiveSession {
  id: string;
  venue_id: string;
  entry_scanned_at: string;
  status: string;
  venues: { name: string; tier: string; address: string };
  bookings: { id: string; venue_slots: { slot_date: string; start_time: string; end_time: string } };
}

interface Props {
  initialSession: ActiveSession | null;
  userId: string;
}

type ViewMode = 'no-session' | 'entry-qr' | 'active-session' | 'session-summary';

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

// ── Simple QR renderer using canvas + qrcode-generator (no external CDN needed)
// We implement a minimal QR using SVG path from the API — or use a data URL
// approach via the browser's built-in canvas API with a helper
function QRDisplay({ value, size = 220 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!value || !canvasRef.current) return;

    // Dynamically load qrcode library
    if (typeof window !== 'undefined' && !(window as any).QRCodeLib) {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = () => {
        setLoaded(true);
        renderQR();
      };
      document.head.appendChild(script);
    } else {
      setLoaded(true);
      renderQR();
    }

    function renderQR() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Use canvas 2d to draw QR manually via a simple approach
      // We'll use the URL-based QR API as fallback
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw placeholder while we fetch
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      // Use Google Charts QR API (free, no key needed)
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&bgcolor=ffffff&color=1A1A2E&margin=2`;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
      };
      img.onerror = () => {
        // Fallback: draw a placeholder
        ctx.fillStyle = '#1A1A2E';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#6C63FF';
        ctx.font = `${size * 0.08}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText('QR unavailable', size / 2, size / 2);
        ctx.font = `${size * 0.05}px system-ui`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('Check connection', size / 2, size / 2 + size * 0.12);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: 16, display: 'block' }}
    />
  );
}

// ── Countdown ring component
function CountdownRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const pct = seconds / total;
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

export default function ActiveSessionScreen({ initialSession, userId }: Props) {
  const router = useRouter();

  const [session, setSession] = useState<ActiveSession | null>(initialSession);
  const [mode, setMode] = useState<ViewMode>(initialSession ? 'active-session' : 'no-session');

  // Entry QR state
  const [entryBookingId, setEntryBookingId] = useState<string | null>(null);
  const [entryQR, setEntryQR] = useState<string | null>(null);
  const [entryQRExpiry, setEntryQRExpiry] = useState<Date | null>(null);
  const [entrySecondsLeft, setEntrySecondsLeft] = useState(0);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  // Exit QR state
  const [exitQR, setExitQR] = useState<string | null>(null);
  const [exitCountdown, setExitCountdown] = useState(60);
  const [exitLoading, setExitLoading] = useState(false);
  const exitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exitRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (secs === 0) setEntryQR(null);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [entryQRExpiry]);

  // ── Poll /api/sessions/active to detect when gym scans exit QR and session closes
  const pollForSessionClosure = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch('/api/sessions/active');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.session) {
        // Session is now closed — fetch summary from the closed session endpoint
        const summaryRes = await fetch(`/api/sessions/summary?sessionId=${session.id}`);
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData);
          setMode('session-summary');
        } else {
          // Can't get summary — gracefully go to no-session
          setSession(null);
          setMode('no-session');
        }
      }
    } catch { /* ignore poll errors */ }
  }, [session]);

  // ── Exit QR auto-refresh every 60s
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
        if (err.error?.includes('already closed') || res.status === 404) {
          // Session was closed (by gym exit scan or auto-close) — show summary
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

  useEffect(() => {
    if (mode !== 'active-session' || !session) return;

    // Initial fetch
    fetchExitQR();

    // Countdown tick
    exitIntervalRef.current = setInterval(() => {
      setExitCountdown(prev => {
        if (prev <= 1) {
          fetchExitQR();
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    // Background poll every 10s to catch exit scan between QR refreshes
    const pollInterval = setInterval(() => {
      pollForSessionClosure();
    }, 10000);

    return () => {
      if (exitIntervalRef.current) clearInterval(exitIntervalRef.current);
      if (exitRefreshRef.current) clearTimeout(exitRefreshRef.current);
      clearInterval(pollInterval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, session?.id]);

  // ── Generate entry QR for a booking
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
        return;
      }
      setEntryQR(data.qrString);
      setEntryQRExpiry(new Date(data.expiresAt));
      setEntryBookingId(bookingId);
      setMode('entry-qr');
    } finally {
      setEntryLoading(false);
    }
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

        {/* Generate entry QR from upcoming booking */}
        <EntryQRLauncher onGenerate={generateEntryQR} loading={entryLoading} error={entryError} />

        <button
          onClick={() => router.push('/app/explore')}
          style={{
            marginTop: 16,
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
    return (
      <div className="mobile-viewport page-slide-in" style={{ minHeight: '100dvh', padding: '20px 20px', display: 'flex', flexDirection: 'column' }}>
        <button onClick={() => setMode('no-session')} style={{ background: 'none', border: 'none', color: '#6C63FF', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 24, alignSelf: 'flex-start' }}>
          ‹ Back
        </button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Show this to staff at entry</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: '#fff' }}>Entry QR Code</div>
        </div>

        {/* QR Container */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          padding: 16,
          margin: '0 auto',
          boxShadow: '0 0 40px rgba(108,99,255,0.3)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {entrySecondsLeft <= 0 ? (
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

        {/* Countdown */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: entrySecondsLeft > 60 ? '#39D98A' : entrySecondsLeft > 30 ? '#FFD166' : '#FF6B6B',
              boxShadow: `0 0 8px ${entrySecondsLeft > 60 ? '#39D98A' : entrySecondsLeft > 30 ? '#FFD166' : '#FF6B6B'}`,
            }} />
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
              Valid for <span style={{ color: '#fff', fontWeight: 500 }}>{Math.floor(entrySecondsLeft / 60)}:{pad(entrySecondsLeft % 60)}</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
            Single-use · Expires 15 min after slot start
          </div>
        </div>

        {/* Instructions */}
        <div style={{
          marginTop: 28,
          background: 'var(--color-card-dark)',
          borderRadius: 14,
          padding: '14px 16px',
        }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>What happens next</div>
          {[
            { icon: '📱', text: 'Show this QR to the staff or kiosk at entry' },
            { icon: '✅', text: 'Your session starts when they scan it' },
            { icon: '🏋️', text: 'Work out — tokens are not deducted yet' },
            { icon: '📤', text: 'Open this screen again when leaving to show your exit QR' },
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
    const slot = (session.bookings as any)?.venue_slots;
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
          borderRadius: 16,
          padding: '14px 16px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
            borderRadius: 12,
            padding: '10px 14px',
            marginBottom: 16,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
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
            background: '#fff',
            borderRadius: 20,
            padding: 16,
            boxShadow: '0 0 40px rgba(57,217,138,0.25)',
          }}>
            {exitLoading && !exitQR ? (
              <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 13, color: '#6C63FF' }}>Generating…</div>
              </div>
            ) : exitQR ? (
              <QRDisplay value={exitQR} size={220} />
            ) : null}
          </div>

          {/* Countdown badge */}
          <div style={{
            position: 'absolute',
            top: -10, right: '50%',
            transform: 'translateX(120px)',
            background: 'var(--color-deep-space)',
            borderRadius: '50%',
            padding: 2,
            border: '2px solid var(--color-card-dark)',
          }}>
            <CountdownRing seconds={exitCountdown} total={60} />
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12, marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Refreshes every 60 seconds · Old QR instantly invalid
          </div>
        </div>

        {/* Token cost preview */}
        <TokenCostPreview venueTier={venue.tier} />

        {/* Session ID */}
        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            Session #{session.id.slice(0, 8).toUpperCase()}
          </div>
        </div>
      </div>
    );
  }

  // ── Session Summary (after exit scan — polled)
  if (mode === 'session-summary' && summary) {
    const durationStr = formatDuration(summary.durationMins);
    return (
      <div className="mobile-viewport page-slide-in" style={{ minHeight: '100dvh', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Success bloom */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(57,217,138,0.15)',
          border: '2px solid rgba(57,217,138,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36,
          marginTop: 40, marginBottom: 24,
          animation: 'bloom 0.5s ease-out',
        }}>
          ✓
        </div>

        <div style={{ fontSize: 22, fontWeight: 500, color: '#fff', marginBottom: 6, textAlign: 'center' }}>
          Great workout!
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 32, textAlign: 'center' }}>
          {summary.venueName}
        </div>

        {/* Stats */}
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

        <button
          onClick={() => router.push('/app/home')}
          style={{
            background: '#6C63FF', color: '#fff', border: 'none', borderRadius: 24,
            padding: '14px', width: '100%', fontSize: 15, fontWeight: 500, cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          Back to home
        </button>
        <button
          onClick={() => router.push('/app/explore')}
          style={{
            background: 'transparent', color: '#6C63FF',
            border: '1px solid rgba(108,99,255,0.3)',
            borderRadius: 24, padding: '14px', width: '100%', fontSize: 15, fontWeight: 500, cursor: 'pointer',
          }}
        >
          Book another session
        </button>
      </div>
    );
  }

  return null;
}

// ── Sub-component: Entry QR launcher (picks from upcoming bookings)
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
      .finally(() => setFetching(false));
  }, []);

  if (fetching) return <div style={{ height: 60 }} />;
  if (bookings.length === 0) return null;

  return (
    <div style={{ width: '100%', marginBottom: 8 }}>
      {error && (
        <div style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 8 }}>{error}</div>
      )}
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Your upcoming booking:</div>
      {bookings.slice(0, 1).map((b: any) => (
        <button
          key={b.id}
          onClick={() => onGenerate(b.id)}
          disabled={loading}
          style={{
            width: '100%',
            background: '#6C63FF',
            border: 'none',
            borderRadius: 14,
            padding: '14px 16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            textAlign: 'left',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
            {loading ? 'Generating QR…' : `Get Entry QR — ${b.venues?.name}`}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>
            {b.venue_slots?.slot_date} · {b.venue_slots?.start_time?.slice(0, 5)}
          </div>
        </button>
      ))}
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
      background: 'var(--color-card-dark)',
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Est. token cost</div>
        <div style={{ fontSize: 18, fontWeight: 500, color: isPeak ? '#FF6B6B' : '#39D98A', marginTop: 2 }}>
          {cost} tokens
        </div>
      </div>
      <div style={{
        fontSize: 11, fontWeight: 500,
        padding: '4px 10px', borderRadius: 20,
        background: isPeak ? 'rgba(255,107,107,0.15)' : 'rgba(57,217,138,0.15)',
        color: isPeak ? '#FF6B6B' : '#39D98A',
        border: `1px solid ${isPeak ? 'rgba(255,107,107,0.3)' : 'rgba(57,217,138,0.3)'}`,
      }}>
        {isPeak ? '🔴 Peak' : '🟢 Off-peak'}
      </div>
    </div>
  );
}
