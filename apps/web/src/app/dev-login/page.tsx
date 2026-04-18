'use client';

// ─────────────────────────────────────────────────────────────────────────────
// DEV LOGIN — only for local development while OTP provider is not configured
// Remove this page (or protect behind NODE_ENV check) before production.
// Uses email+password which the seed.sql already created for all test accounts.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

const TEST_ACCOUNTS = [
  { label: 'User 1 — Ananya Sharma (148 tokens)',  email: 'user1@joinvigor.co',           password: 'Password123!', redirect: '/app' },
  { label: 'User 2 — Karan Mehta (85 tokens)',     email: 'user2@joinvigor.co',           password: 'Password123!', redirect: '/app' },
  { label: 'User 3 — Sneha Iyer (32 tokens)',      email: 'user3@joinvigor.co',           password: 'Password123!', redirect: '/app' },
  { label: 'Gym Owner — Iron Republic (Gold)',     email: 'owner@ironrepublic.in',        password: 'Password123!', redirect: '/gym' },
  { label: 'Gym Owner — Centurion Fitness (Silver)', email: 'owner@centurionfitness.in', password: 'Password123!', redirect: '/gym' },
  { label: 'Gym Owner — Fit Zone (Bronze)',        email: 'owner@fitzone.in',             password: 'Password123!', redirect: '/gym' },
  { label: 'Admin',                                email: 'admin@joinvigor.co',           password: 'Password123!', redirect: '/admin' },
];

export default function DevLoginPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function loginAs(account: typeof TEST_ACCOUNTS[0]) {
    setLoading(account.email);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });

    if (error) {
      setError(`${error.message} — make sure seed.sql has been run in Supabase.`);
      setLoading(null);
      return;
    }

    router.push(account.redirect);
  }

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#1A1A2E] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <path d="M6 22 L14 6 L22 22" stroke="#6C63FF" strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.5 15.5 L18.5 15.5" stroke="#39D98A" strokeWidth="2.5"
                    strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-2xl font-medium tracking-[-0.03em]">
            <span className="text-[#6C63FF]">V</span>igor
          </span>
        </div>

        <div className="inline-block bg-[#FFD166]/10 text-[#FFD166] text-xs font-medium px-3 py-1 rounded-full mb-8 border border-[#FFD166]/20">
          Dev login — remove before production
        </div>

        <h1 className="text-[22px] font-medium tracking-[-0.03em] mb-2">
          Sign in as a test account
        </h1>
        <p className="text-sm text-white/40 mb-6">
          All accounts use password <span className="text-white/60 font-mono">Password123!</span>
        </p>

        {error && (
          <div className="bg-[#FF6B6B]/10 border border-[#FF6B6B]/20 rounded-xl px-4 py-3 text-xs text-[#FF6B6B] mb-4">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {TEST_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              onClick={() => loginAs(account)}
              disabled={loading !== null}
              className="w-full bg-[#23233A] hover:bg-[#2a2a45] text-left rounded-xl px-4 py-3
                         disabled:opacity-40 transition-colors active:scale-[0.98]"
            >
              <div className="text-sm font-medium text-white">{account.label}</div>
              <div className="text-xs text-white/30 mt-0.5">{account.email}</div>
              {loading === account.email && (
                <div className="text-xs text-[#6C63FF] mt-1">Signing in...</div>
              )}
            </button>
          ))}
        </div>

        <p className="text-xs text-white/20 mt-8 text-center">
          <a href="/login" className="underline hover:text-white/40">← Back to real login</a>
        </p>
      </div>
    </div>
  );
}
