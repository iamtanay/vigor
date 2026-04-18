'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TierBadge from '@/components/TierBadge';
import { VigorMark } from '@/components/VigorLogo';
import { TIER_BASE_RATES } from '@vigor/lib/tokens/formula';
import type { Venue, VenueSlot } from '@vigor/types';

const AMENITY_ICONS: Record<string, string> = {
  'ac': '❄️', 'air conditioning': '❄️', 'lockers': '🔐',
  'parking': '🅿️', 'pool': '🏊', 'sauna': '🧖',
  'showers': '🚿', 'wifi': '📶', 'classes': '🏃', 'trainers': '💪',
};
function amenityIcon(a: string) {
  const k = a.toLowerCase();
  for (const [key, val] of Object.entries(AMENITY_ICONS)) {
    if (k.includes(key)) return val;
  }
  return '✓';
}

function isPeakAt(t: string) {
  const h = parseInt(t.split(':')[0]!);
  return (h >= 6 && h <= 9) || (h >= 17 && h <= 21);
}

function tokenCost(tier: string, startTime: string, discount = 0) {
  const base = TIER_BASE_RATES[tier as keyof typeof TIER_BASE_RATES] ?? 8;
  return Math.ceil(base * (isPeakAt(startTime) ? 1.5 : 1.0) * (1 - discount));
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (dt.getTime() === today.getTime()) return 'Today';
  if (dt.getTime() === tomorrow.getTime()) return 'Tomorrow';
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function groupByDate(slots: Partial<VenueSlot>[]) {
  const out: Record<string, Partial<VenueSlot>[]> = {};
  for (const s of slots) {
    const d = s.slot_date!;
    (out[d] ??= []).push(s);
  }
  return out;
}

// Collapse to 4 slots per day initially
const INITIAL_VISIBLE = 4;

interface Props {
  venue: Venue;
  slots: Partial<VenueSlot>[];
  commitment: any;
  ratings: any[];
  tokenBalance: number;
  userId: string;
}

export default function VenueDetailScreen({ venue, slots, commitment, ratings, tokenBalance }: Props) {
  const router = useRouter();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const discount = commitment?.discount_rate ?? 0;
  const byDate = groupByDate(slots);
  const dates = Object.keys(byDate);

  function toggleDate(d: string) {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(d) ? next.delete(d) : next.add(d);
      return next;
    });
  }

  async function handleBook() {
    if (!selectedSlot) return;
    setBooking(true);
    setBookingError('');
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlot, venueId: venue.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Booking failed');
      router.push(`/app/booking/${data.bookingId}`);
    } catch (err: any) {
      setBookingError(err.message);
      setBooking(false);
    }
  }

  const selSlot = slots.find(s => s.id === selectedSlot);
  const cost = selSlot ? tokenCost(venue.tier, selSlot.start_time!, discount) : null;
  const canAfford = cost !== null && tokenBalance >= cost;

  return (
    <div className="page-slide-in" style={{ paddingBottom: 120 }}>

      {/* ── Hero ── */}
      <div style={{
        height: 180,
        background: 'linear-gradient(135deg, #1E1E38 0%, #14142A 100%)',
        position: 'relative',
      }}>
        {/* Decorative V watermark */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.06 }}>
          <VigorMark size={120} />
        </div>

        {/* Back */}
        <button onClick={() => router.back()} style={{
          position: 'absolute', top: 52, left: 16,
          background: 'rgba(0,0,0,0.35)', border: 'none', borderRadius: '50%',
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff', fontSize: 20, backdropFilter: 'blur(8px)',
        }}>‹</button>

        {/* Fade to page bg */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 72, background: 'linear-gradient(transparent, #1A1A2E)' }} />
      </div>

      {/* ── Info ── */}
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: '#fff', letterSpacing: '-0.02em' }}>
              {venue.name}
            </h1>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', marginTop: 3 }}>
              {venue.address}, {venue.city}
            </div>
          </div>
          <TierBadge tier={venue.tier} />
        </div>

        {/* Stats strip */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: 'var(--color-card-dark)', borderRadius: 12, overflow: 'hidden' }}>
          {[
            { label: 'Rating', value: venue.avg_rating ? `★ ${venue.avg_rating.toFixed(1)}` : '—', color: '#FFD166' },
            { label: 'Hours', value: `${venue.opening_time?.slice(0,5)}–${venue.closing_time?.slice(0,5)}`, color: '#fff' },
            { label: 'Base rate', value: `${TIER_BASE_RATES[venue.tier]}t`, color: '#39D98A' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 4px', borderRight: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Commitment badge */}
        {commitment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(57,217,138,0.08)', border: '1px solid rgba(57,217,138,0.22)', borderRadius: 10, padding: '9px 14px', marginBottom: 16 }}>
            <span style={{ color: '#39D98A', fontSize: 14 }}>✓</span>
            <span style={{ fontSize: 13, color: '#39D98A', fontWeight: 500 }}>
              Committed · {Math.round(discount * 100)}% off
            </span>
            <span style={{ fontSize: 11, color: 'rgba(57,217,138,0.5)', marginLeft: 'auto' }}>
              until {new Date(commitment.ends_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}

        {/* Amenities */}
        {venue.amenities && venue.amenities.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>Amenities</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {venue.amenities.map(a => (
                <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'var(--color-card-dark)', borderRadius: 8, padding: '5px 11px', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  <span>{amenityIcon(a)}</span><span style={{ textTransform: 'capitalize' }}>{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Slot picker ── compact, grouped by date, collapsible */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
            Available Slots
          </div>

          {dates.length === 0 && (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', padding: '16px 0' }}>No slots available</div>
          )}

          {dates.map(date => {
            const daySlots = byDate[date]!;
            const expanded = expandedDates.has(date);
            const visible = expanded ? daySlots : daySlots.slice(0, INITIAL_VISIBLE);
            const hasMore = daySlots.length > INITIAL_VISIBLE;

            return (
              <div key={date} style={{ marginBottom: 16 }}>
                {/* Date header */}
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{fmtDate(date)}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: 400 }}>
                    {daySlots.filter(s => (s.capacity ?? 0) - (s.booked_count ?? 0) > 0).length} slots open
                  </span>
                </div>

                {/* Compact 2-column grid of time buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {visible.map(slot => {
                    const avail = (slot.capacity ?? 0) - (slot.booked_count ?? 0);
                    const full = avail <= 0;
                    const peak = isPeakAt(slot.start_time!);
                    const cost = tokenCost(venue.tier, slot.start_time!, discount);
                    const selected = selectedSlot === slot.id;

                    return (
                      <button
                        key={slot.id}
                        disabled={full}
                        onClick={() => setSelectedSlot(selected ? null : slot.id!)}
                        style={{
                          padding: '10px 12px',
                          background: selected ? 'rgba(108,99,255,0.18)' : full ? 'rgba(255,255,255,0.03)' : 'var(--color-card-dark)',
                          border: `1px solid ${selected ? '#6C63FF' : full ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'}`,
                          borderRadius: 10, cursor: full ? 'not-allowed' : 'pointer',
                          opacity: full ? 0.4 : 1, textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: full ? 'rgba(255,255,255,0.3)' : '#fff' }}>
                            {slot.start_time?.slice(0, 5)}
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: '2px 5px', borderRadius: 5,
                            background: peak ? 'rgba(255,107,107,0.15)' : 'rgba(108,99,255,0.15)',
                            color: peak ? '#FF6B6B' : '#A09BFF',
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            {peak ? 'Peak' : 'Off'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: full ? 'rgba(255,255,255,0.25)' : peak ? '#FF6B6B' : '#39D98A' }}>
                            {cost}t
                          </span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                            {full ? 'Full' : `${avail} left`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Show more / less */}
                {hasMore && (
                  <button
                    onClick={() => toggleDate(date)}
                    style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6C63FF', padding: '4px 0', fontWeight: 500 }}
                  >
                    {expanded ? `Show fewer ↑` : `+${daySlots.length - INITIAL_VISIBLE} more slots ↓`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Ratings */}
        {ratings.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>Reviews</div>
            {ratings.slice(0, 3).map((r: any, i) => (
              <div key={i} style={{ background: 'var(--color-card-dark)', borderRadius: 10, padding: '11px 14px', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                  <span style={{ color: '#FFD166', fontSize: 12, letterSpacing: '0.05em' }}>{'★'.repeat(r.score)}{'☆'.repeat(5 - r.score)}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{r.users?.name ?? 'Member'}</span>
                </div>
                {r.note && <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{r.note}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {bookingError && (
          <div style={{ padding: '10px 14px', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)', borderRadius: 10, color: '#FF6B6B', fontSize: 13, marginBottom: 12 }}>
            {bookingError}
          </div>
        )}
      </div>

      {/* ── Sticky booking CTA ── */}
      {selectedSlot && (
        <div style={{
          position: 'fixed', bottom: 72, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 430, padding: '12px 20px 14px',
          background: 'rgba(26,26,46,0.97)', backdropFilter: 'blur(12px)',
          borderTop: '0.5px solid rgba(108,99,255,0.2)', zIndex: 40,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                {selSlot?.slot_date} · {selSlot?.start_time?.slice(0,5)}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                Balance: {tokenBalance} tokens
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: canAfford ? '#39D98A' : '#FF6B6B' }}>
                {cost} tokens
              </div>
              {!canAfford && <div style={{ fontSize: 11, color: '#FF6B6B', marginTop: 1 }}>Insufficient balance</div>}
            </div>
          </div>
          <button
            onClick={handleBook}
            disabled={booking || !canAfford}
            style={{
              width: '100%', padding: '14px',
              background: !canAfford ? 'rgba(108,99,255,0.25)' : '#6C63FF',
              border: 'none', borderRadius: 14, color: '#fff',
              fontSize: 15, fontWeight: 600, cursor: !canAfford ? 'not-allowed' : 'pointer',
              letterSpacing: '-0.01em',
            }}
          >
            {booking ? 'Booking…' : !canAfford ? 'Top up tokens' : `Use ${cost} tokens`}
          </button>
        </div>
      )}
    </div>
  );
}
