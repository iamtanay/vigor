'use client';

// ─── DEV LOGIN ─────────────────────────────────────────────────────────────────
// One-click sign-in for all seed accounts. Remove / hard-gate before production.
// ──────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import VigorLogo from '@/components/VigorLogo';

const ACCOUNTS = [
  { label: 'Ananya Sharma',      sub: 'User · 148 tokens',          email: 'user1@joinvigor.co',           password: 'Password123!', redirect: '/app/home' },
  { label: 'Karan Mehta',        sub: 'User · 85 tokens',           email: 'user2@joinvigor.co',           password: 'Password123!', redirect: '/app/home' },
  { label: 'Sneha Iyer',         sub: 'User · 32 tokens',           email: 'user3@joinvigor.co',           password: 'Password123!', redirect: '/app/home' },
  { label: 'Iron Republic',      sub: 'Gym owner · Gold',           email: 'owner@ironrepublic.in',        password: 'Password123!', redirect: '/gym' },
  { label: 'Centurion Fitness',  sub: 'Gym owner · Silver',         email: 'owner@centurionfitness.in',    password: 'Password123!', redirect: '/gym' },
  { label: 'Fit Zone',           sub: 'Gym owner · Bronze',         email: 'owner@fitzone.in',             password: 'Password123!', redirect: '/gym' },
  { label: 'Admin',              sub: 'Platform admin',             email: 'admin@joinvigor.co',           password: 'Password123!', redirect: '/admin' },
];

const GROUP_COLORS = ['#6C63FF', '#6C63FF', '#6C63FF', '#39D98A', '#39D98A', '#39D98A', '#FF6B6B'];

export default function DevLoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function loginAs(account: typeof ACCOUNTS[0]) {
    setLoading(account.email); setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: account.email, password: account.password });
    if (error) { setError(`${error.message} — run fix_auth_passwords.sql if this is your first setup.`); setLoading(null); return; }
    router.push(account.redirect);
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0D0D1A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        <div style={{ marginBottom: 8 }}>
          <VigorLogo height={30} />
        </div>

        <span style={{ display: 'inline-block', background: 'rgba(255,209,102,0.1)', color: '#FFD166', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, border: '1px solid rgba(255,209,102,0.2)', marginBottom: 24 }}>
          Dev login — remove before production
        </span>

        <h1 style={{ fontSize: 20, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em', marginBottom: 4 }}>
          Sign in as test account
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>
          All accounts · password: <code style={{ color: 'rgba(255,255,255,0.55)' }}>Password123!</code>
        </p>

        {error && (
          <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#FF6B6B', marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ACCOUNTS.map((acc, i) => (
            <button
              key={acc.email}
              onClick={() => loginAs(acc)}
              disabled={loading !== null}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#1A1A2E', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '12px 14px',
                cursor: 'pointer', textAlign: 'left', opacity: loading && loading !== acc.email ? 0.5 : 1,
                transition: 'border-color 0.15s',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: GROUP_COLORS[i], flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{acc.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{acc.sub}</div>
              </div>
              {loading === acc.email && <span style={{ fontSize: 12, color: '#6C63FF' }}>Signing in…</span>}
            </button>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 24 }}>
          <a href="/login" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}>← Real login</a>
        </p>
      </div>
    </div>
  );
}
