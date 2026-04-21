'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import TierBadge from '@/components/TierBadge';

interface Props { booking: any }

export default function BookingConfirmScreen({ booking }: Props) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(booking.status === 'cancelled');
  const [generatingQR, setGeneratingQR] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  const slot = booking.venue_slots;
  const venue = booking.venues;
  const slotDt = slot ? new Date(`${slot.slot_date}T${slot.start_time}`) : null;
  const hoursUntil = slotDt ? (slotDt.getTime() - Date.now()) / 3600000 : 0;
  const canCancelFree = hoursUntil > 2;

  // Show QR button if slot is within 30 min of start (entry window)
  const slotStarted = slotDt ? slotDt.getTime() <= Date.now() : false;
  const slotInWindow = slotDt
    ? slotDt.getTime() <= Date.now() + 30 * 60 * 1000 && slotDt.getTime() >= Date.now() - 15 * 60 * 1000
    : false;
  const isCompleted = booking.status === 'completed';

  async function handleCancel() {
    if (!confirm(canCancelFree ? 'Cancel this booking?' : 'Cancelling now will deduct 1 token penalty. Continue?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, { method: 'POST' });
      if (res.ok) { setCancelled(true); }
      else { alert('Could not cancel. Please try again.'); }
    } finally { setCancelling(false); }
  }

  async function handleGetEntryQR() {
    setGeneratingQR(true);
    setQrError(null);
    try {
      const res = await fetch('/api/sessions/generate-entry-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQrError(data.error || 'Failed to generate QR');
        return;
      }
      // Navigate to session screen which will show entry QR
      router.push(`/app/session?bookingId=${booking.id}`);
    } catch {
      setQrError('Network error. Please try again.');
    } finally {
      setGeneratingQR(false);
    }
  }

  const statusColor = cancelled ? '#FF6B6B' : isCompleted ? '#39D98A' : '#6C63FF';
  const statusLabel = cancelled ? 'Cancelled' : isCompleted ? 'Completed' : 'Confirmed';

  return (
    <div className="page-slide-in" style={{ padding: '16px 20px 20px' }}>
      {/* Back */}
      <button onClick={() => router.back()} style={{
        background: 'none', border: 'none', color: '#6C63FF',
        fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        ‹ Back
      </button>

      {/* Status badge */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: `${statusColor}22`,
          border: `2px solid ${statusColor}44`,
          margin: '0 auto 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}>
          {cancelled ? '✕' : isCompleted ? '✓' : '✓'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: '#fff', marginBottom: 4 }}>
          Booking {statusLabel}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          #{booking.id.slice(0, 8).toUpperCase()}
        </div>
      </div>

      {/* Venue + slot details */}
      <div style={{
        background: 'var(--color-card-dark)',
        borderRadius: 16, padding: '16px 18px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#fff', marginBottom: 4 }}>
              {venue?.name ?? 'Venue'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{venue?.address}</div>
          </div>
          <TierBadge tier={venue?.tier} />
        </div>
        {slot && (
          <div style={{ display: 'flex', gap: 12, paddingTop: 12, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Date</div>
              <div style={{ fontSize: 13, color: '#fff', marginTop: 2 }}>
                {new Date(slot.slot_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Time</div>
              <div style={{ fontSize: 13, color: '#fff', marginTop: 2 }}>
                {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Check-in instructions */}
      {!cancelled && !isCompleted && (
        <div style={{
          background: 'rgba(108,99,255,0.08)',
          border: '1px solid rgba(108,99,255,0.2)',
          borderRadius: 14, padding: '14px 16px', marginBottom: 16,
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#6C63FF', marginBottom: 8 }}>How to check in</div>
          {[
            { icon: '📱', text: 'Tap "Get Entry QR" below when you arrive (available 15 min before slot start)' },
            { icon: '🔍', text: 'Show the QR code to staff — it\'s single-use and expires 15 min after slot start' },
            { icon: '🏋️', text: 'Work out — tokens are NOT deducted at check-in' },
            { icon: '📤', text: 'Tap "Session" in the bottom nav when leaving to show your Exit QR' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '5px 0' }}>
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{item.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* QR error */}
      {qrError && (
        <div style={{
          background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)',
          borderRadius: 10, padding: '10px 14px', marginBottom: 12,
          color: '#FF6B6B', fontSize: 13,
        }}>
          {qrError}
        </div>
      )}

      {/* Actions */}
      {!cancelled && !isCompleted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {/* Get Entry QR — always visible for upcoming confirmed bookings */}
          {!booking.entry_qr_used && (
            <button
              onClick={handleGetEntryQR}
              disabled={generatingQR}
              style={{
                background: '#6C63FF', color: '#fff', border: 'none',
                borderRadius: 24, padding: '14px', width: '100%',
                fontSize: 15, fontWeight: 500, cursor: generatingQR ? 'not-allowed' : 'pointer',
                opacity: generatingQR ? 0.7 : 1,
              }}
            >
              {generatingQR ? 'Generating…' : '📱 Get Entry QR'}
            </button>
          )}

          {/* Already used */}
          {booking.entry_qr_used && (
            <button
              onClick={() => router.push('/app/session')}
              style={{
                background: '#39D98A', color: '#0D1A0D', border: 'none',
                borderRadius: 24, padding: '14px', width: '100%',
                fontSize: 15, fontWeight: 500, cursor: 'pointer',
              }}
            >
              📤 View Active Session & Exit QR
            </button>
          )}

          {/* Cancel button */}
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              background: 'transparent',
              border: `1px solid ${canCancelFree ? 'rgba(255,255,255,0.15)' : 'rgba(255,107,107,0.3)'}`,
              color: canCancelFree ? 'rgba(255,255,255,0.5)' : '#FF6B6B',
              borderRadius: 24, padding: '12px', width: '100%',
              fontSize: 14, cursor: cancelling ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelling ? 'Cancelling…' : canCancelFree ? 'Cancel booking (free)' : 'Cancel (1 token penalty)'}
          </button>
        </div>
      )}

      {isCompleted && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
            Session completed ✓
          </div>
          <button
            onClick={() => router.push('/app/explore')}
            style={{
              background: '#6C63FF', color: '#fff', border: 'none',
              borderRadius: 24, padding: '14px 28px',
              fontSize: 14, fontWeight: 500, cursor: 'pointer',
            }}
          >
            Book another session
          </button>
        </div>
      )}
    </div>
  );
}
