'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import TierBadge from '@/components/TierBadge';

interface Props { booking: any }

export default function BookingConfirmScreen({ booking }: Props) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(booking.status === 'cancelled');

  const slot = booking.venue_slots;
  const venue = booking.venues;
  const slotDt = slot ? new Date(`${slot.slot_date}T${slot.start_time}`) : null;
  const hoursUntil = slotDt ? (slotDt.getTime() - Date.now()) / 3600000 : 0;
  const canCancelFree = hoursUntil > 2;

  async function handleCancel() {
    if (!confirm(canCancelFree ? 'Cancel this booking?' : 'Cancelling now will deduct 1 token penalty. Continue?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, { method: 'POST' });
      if (res.ok) { setCancelled(true); }
      else { alert('Could not cancel. Please try again.'); }
    } finally { setCancelling(false); }
  }

  const statusColor = cancelled ? '#FF6B6B' : booking.status === 'completed' ? '#39D98A' : '#6C63FF';
  const statusLabel = cancelled ? 'Cancelled' : booking.status === 'completed' ? 'Completed' : 'Confirmed';

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
          {cancelled ? '✕' : booking.status === 'completed' ? '✓' : '✓'}
        </div>
        <div style={{ fontSize: 20, fontWeight: 500, color: '#fff', marginBottom: 4 }}>
          Booking {statusLabel}
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          #{booking.id.slice(0, 8).toUpperCase()}
        </div>
      </div>

      {/* Details card */}
      <div style={{
        background: 'var(--color-card-dark)',
        borderRadius: 16, padding: '20px',
        border: '0.5px solid rgba(255,255,255,0.06)',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#fff' }}>{venue?.name}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{venue?.address}</div>
          </div>
          {venue?.tier && <TierBadge tier={venue.tier} />}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Row label="Date" value={slot?.slot_date} />
          <Row label="Time" value={`${slot?.start_time?.slice(0,5)} – ${slot?.end_time?.slice(0,5)}`} />
          <Row label="Status" value={statusLabel} valueColor={statusColor} />
        </div>
      </div>

      {/* Info */}
      <div style={{
        background: 'rgba(108,99,255,0.08)',
        border: '1px solid rgba(108,99,255,0.2)',
        borderRadius: 12, padding: '14px 16px',
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, color: '#A09BFF', fontWeight: 500, marginBottom: 6 }}>
          💡 How to check in
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
          When you arrive, go to <strong style={{ color: '#A09BFF' }}>ActiVity</strong> tab to get your entry QR code.
          Tokens are only deducted when you exit.
        </div>
      </div>

      {/* Cancel button */}
      {!cancelled && booking.status === 'confirmed' && (
        <button
          onClick={handleCancel}
          disabled={cancelling}
          style={{
            width: '100%', padding: '13px',
            background: 'transparent',
            border: '1px solid rgba(255,107,107,0.3)',
            borderRadius: 12, color: '#FF6B6B',
            fontSize: 14, cursor: 'pointer',
          }}
        >
          {cancelling ? 'Cancelling...' : canCancelFree ? 'Cancel booking (free)' : 'Cancel booking (1 token penalty)'}
        </button>
      )}
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: valueColor ?? '#fff' }}>{value}</span>
    </div>
  );
}
