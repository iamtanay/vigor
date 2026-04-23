import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import VigorLogo from '@/components/VigorLogo';
import TierBadge from '@/components/TierBadge';

export default async function GymDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/gym/login');

  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .single();

  if (!profile || !['gym_owner', 'admin'].includes(profile.role)) {
    redirect('/gym/login');
  }

  const { data: venue } = await supabase
    .from('venues')
    .select('id, name, tier, address, opening_time, closing_time, avg_rating, total_ratings')
    .eq('owner_user_id', profile.id)
    .eq('status', 'active')
    .maybeSingle();

  // Live sessions today
  const today = new Date().toISOString().split('T')[0];
  const { data: todaySessions } = venue ? await supabase
    .from('sessions')
    .select('id, status, entry_scanned_at, tokens_deducted')
    .eq('venue_id', venue.id)
    .gte('entry_scanned_at', `${today}T00:00:00`)
    : { data: [] };

  const openSessions = (todaySessions ?? []).filter((s: any) => s.status === 'open');
  const closedToday = (todaySessions ?? []).filter((s: any) => s.status !== 'open');
  const tokensToday = closedToday.reduce((sum: number, s: any) => sum + (s.tokens_deducted || 0), 0);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-deep-space)', fontFamily: 'system-ui' }}>
      {/* Header */}
      <header style={{
        padding: '16px 20px',
        background: 'rgba(26,26,46,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <VigorLogo height={26} />
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {profile.name || 'Owner'}
        </div>
      </header>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px' }}>
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
              <TierBadge tier={venue.tier as any} />
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Rating</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#FFD166' }}>⭐ {venue.avg_rating.toFixed(1)}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Hours</div>
                <div style={{ fontSize: 13, color: '#fff' }}>{venue.opening_time?.slice(0,5)} – {venue.closing_time?.slice(0,5)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: 'var(--color-card-dark)', borderRadius: 16, padding: 20, marginBottom: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
            No active venue linked to this account
          </div>
        )}

        {/* Today's stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
          {[
            { label: 'Active now', value: openSessions.length, color: '#39D98A', icon: '🟢' },
            { label: 'Sessions today', value: (todaySessions ?? []).length, color: '#6C63FF', icon: '📊' },
            { label: 'Tokens today', value: tokensToday, color: '#FFD166', icon: '🪙' },
          ].map((stat) => (
            <div key={stat.label} style={{
              background: 'var(--color-card-dark)', borderRadius: 12, padding: '14px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Scan QR CTA */}
        <Link href="/gym/scan" style={{ textDecoration: 'none', display: 'block', marginBottom: 14 }}>
          <div style={{
            background: '#6C63FF',
            borderRadius: 16, padding: '18px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>
              📷
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>Scan QR Codes</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
                Entry and exit scans for members
              </div>
            </div>
            <div style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>›</div>
          </div>
        </Link>

        {/* Active sessions list */}
        {openSessions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              Active sessions ({openSessions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {openSessions.slice(0, 5).map((s: any) => {
                const mins = s.entry_scanned_at
                  ? Math.round((Date.now() - new Date(s.entry_scanned_at).getTime()) / 60000)
                  : 0;
                return (
                  <div key={s.id} style={{
                    background: 'var(--color-card-dark)',
                    borderRadius: 12, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#39D98A', boxShadow: '0 0 6px #39D98A' }} />
                      <div style={{ fontSize: 12, color: '#fff' }}>Session {s.id.slice(0, 6).toUpperCase()}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                      {mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase 4 placeholder */}
        <div style={{
          borderRadius: 14,
          border: '1px dashed rgba(255,255,255,0.1)',
          padding: '16px 18px',
          color: 'rgba(255,255,255,0.3)',
          fontSize: 13,
          textAlign: 'center',
        }}>
          Full dashboard with session history & settlements coming in Phase 4
        </div>
      </div>
    </div>
  );
}
