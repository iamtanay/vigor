'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import VigorLogo from '@/components/VigorLogo';
import TierBadge from '@/components/TierBadge';

interface VenueData {
  id: string;
  name: string;
  description: string | null;
  tier: string;
  address: string;
  opening_time: string | null;
  closing_time: string | null;
  phone: string | null;
  amenities: string[];
  activity_types: string[];
  avg_rating: number;
  total_ratings: number;
  payout_rate_inr: number;
  status: string;
}

const AMENITY_OPTIONS = [
  'Changing rooms', 'Lockers', 'Showers', 'Parking', 'AC', 'Wi-Fi',
  'Cafeteria', 'Towel service', 'Water dispenser', 'Steam room', 'Sauna',
  'Personal training', 'Cardio zone', 'Free weights', 'Group classes',
  'Swimming pool', 'Basketball court', 'Yoga studio',
];

const ACTIVITY_OPTIONS = [
  'Gym', 'Yoga', 'Zumba', 'CrossFit', 'Boxing', 'Cycling', 'Pilates',
  'Swimming', 'Basketball', 'Badminton', 'Squash', 'Martial arts',
  'Dance', 'Aerobics', 'Functional training',
];

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

function ToggleChip({
  label,
  selected,
  onToggle,
}: {
  label: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
        border: `1px solid ${selected ? '#6C63FF' : 'rgba(255,255,255,0.1)'}`,
        background: selected ? 'rgba(108,99,255,0.15)' : 'transparent',
        color: selected ? '#6C63FF' : 'rgba(255,255,255,0.45)',
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {selected ? '✓ ' : ''}{label}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.35)',
      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10, marginTop: 20,
    }}>
      {children}
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '10px 12px', fontSize: 14, color: '#fff',
          outline: 'none', boxSizing: 'border-box', fontFamily: 'system-ui',
        }}
      />
      {hint && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export default function GymVenueEditorScreen() {
  const [venue, setVenue]       = useState<VenueData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [openingTime, setOpeningTime] = useState('');
  const [closingTime, setClosingTime] = useState('');
  const [phone, setPhone]             = useState('');
  const [amenities, setAmenities]     = useState<string[]>([]);
  const [activities, setActivities]   = useState<string[]>([]);

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/gym/venue');
        if (!res.ok) throw new Error('Failed to load venue');
        const data = await res.json();
        const v: VenueData = data.venue;
        setVenue(v);
        setName(v.name ?? '');
        setDescription(v.description ?? '');
        setOpeningTime(v.opening_time?.slice(0, 5) ?? '');
        setClosingTime(v.closing_time?.slice(0, 5) ?? '');
        setPhone(v.phone ?? '');
        setAmenities(v.amenities ?? []);
        setActivities(v.activity_types ?? []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        description,
        opening_time: openingTime,
        closing_time: closingTime,
        phone,
        amenities,
        activity_types: activities,
      };
      const res = await fetch('/api/gym/venue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Save failed');
      }
      const data = await res.json();
      setVenue(data.venue);
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-deep-space)', fontFamily: 'system-ui', paddingBottom: 100 }}>

      <header style={{
        padding: '16px 20px',
        background: 'rgba(26,26,46,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <VigorLogo height={26} />
        <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>Venue Profile</div>
        <div style={{ width: 60 }} />
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px' }}>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[80, 60, 60, 120].map((h, i) => (
              <div key={i} style={{ height: h, borderRadius: 14, background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        ) : !venue ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            No active venue linked to this account.
          </div>
        ) : (
          <>
            {/* Read-only venue summary */}
            <div style={{
              background: 'var(--color-card-dark)', borderRadius: 14, padding: '14px 16px', marginBottom: 4,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>Venue ID</div>
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>
                  {venue.id.slice(0, 16)}…
                </div>
              </div>
              <TierBadge tier={venue.tier as 'bronze' | 'silver' | 'gold'} />
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginBottom: 20, paddingLeft: 4 }}>
              Tier and payout rate are managed by Vigor admin.
            </div>

            {/* Basic info */}
            <SectionLabel>Basic info</SectionLabel>
            <div style={{ background: 'var(--color-card-dark)', borderRadius: 14, padding: '16px' }}>
              <FieldInput label="Venue name" value={name} onChange={setName} placeholder="e.g. Iron Temple Fitness" />
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Description</div>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Tell members what makes your gym great…"
                  rows={3}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                    padding: '10px 12px', fontSize: 14, color: '#fff',
                    outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                    fontFamily: 'system-ui', lineHeight: 1.5,
                  }}
                />
              </div>
              <FieldInput label="Phone" value={phone} onChange={setPhone} type="tel" placeholder="+91 98765 43210" />
            </div>

            {/* Hours */}
            <SectionLabel>Opening hours</SectionLabel>
            <div style={{
              background: 'var(--color-card-dark)', borderRadius: 14, padding: '16px',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              <FieldInput label="Opens at" value={openingTime} onChange={setOpeningTime} type="time" hint="24h format" />
              <FieldInput label="Closes at" value={closingTime} onChange={setClosingTime} type="time" hint="24h format" />
            </div>

            {/* Amenities */}
            <SectionLabel>Amenities</SectionLabel>
            <div style={{ background: 'var(--color-card-dark)', borderRadius: 14, padding: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AMENITY_OPTIONS.map(a => (
                  <ToggleChip
                    key={a}
                    label={a}
                    selected={amenities.includes(a)}
                    onToggle={() => toggleItem(amenities, setAmenities, a)}
                  />
                ))}
              </div>
            </div>

            {/* Activity types */}
            <SectionLabel>Activity types</SectionLabel>
            <div style={{ background: 'var(--color-card-dark)', borderRadius: 14, padding: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {ACTIVITY_OPTIONS.map(a => (
                  <ToggleChip
                    key={a}
                    label={a}
                    selected={activities.includes(a)}
                    onToggle={() => toggleItem(activities, setActivities, a)}
                  />
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: 16, padding: '12px 14px', borderRadius: 12,
                background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)',
                fontSize: 13, color: '#FF6B6B',
              }}>
                {error}
              </div>
            )}

            {/* Save button */}
            <div style={{ marginTop: 24 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  width: '100%', padding: '15px', borderRadius: 14,
                  fontSize: 15, fontWeight: 600, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                  background: saved
                    ? 'rgba(57,217,138,0.2)'
                    : saving
                    ? 'rgba(108,99,255,0.4)'
                    : '#6C63FF',
                  color: saved ? '#39D98A' : '#fff',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </div>

      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(26,26,46,0.96)', backdropFilter: 'blur(16px)',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))', zIndex: 50,
      }}>
        <NavLink href="/gym"             icon="🏠" label="Dashboard" />
        <NavLink href="/gym/scan"        icon="📷" label="Scan" />
        <NavLink href="/gym/sessions"    icon="📋" label="Sessions" />
        <NavLink href="/gym/settlements" icon="💳" label="Settle" />
        <NavLink href="/gym/venue"       icon="⚙️" label="Venue" active />
      </nav>
    </div>
  );
}