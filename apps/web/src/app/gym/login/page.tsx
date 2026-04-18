'use client';

import VigorLogo from '@/components/VigorLogo';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

type Step = 'email' | 'otp';

export default function GymLoginPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function sendOTP() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false }, // gym owners must be pre-registered
    });

    setLoading(false);
    if (error) {
      setError(error.message === 'For security purposes, you can only request this after 60 seconds'
        ? error.message
        : 'Email not found. Contact Vigor support.');
    } else {
      setStep('otp');
    }
  }

  async function verifyOTP() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });

    setLoading(false);
    if (error) {
      setError('Invalid or expired code. Try again.');
    } else {
      router.push('/gym');
    }
  }

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div style={{ marginBottom: 32 }}>
          <VigorLogo height={30} />
        </div>

        {step === 'email' ? (
          <>
            <h1 className="text-[24px] font-medium tracking-[-0.03em] mb-2">Partner login</h1>
            <p className="text-sm text-white/40 mb-8">
              Enter your registered gym owner email.
            </p>

            <input
              type="email"
              placeholder="gym@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#23233A] rounded-xl px-4 py-3 text-sm text-white
                         placeholder:text-white/30 outline-none focus:ring-1 focus:ring-vigor-violet mb-4"
            />

            {error && <p className="text-burn-coral text-xs mb-4">{error}</p>}

            <button
              onClick={sendOTP}
              disabled={loading || !email.includes('@')}
              className="w-full bg-vigor-violet text-white rounded-2xl py-4 text-sm font-medium
                         disabled:opacity-40 active:scale-[0.98]"
            >
              {loading ? 'Sending...' : 'Send login code'}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-[24px] font-medium tracking-[-0.03em] mb-2">Check your email</h1>
            <p className="text-sm text-white/40 mb-8">
              Code sent to <span className="text-white/60">{email}</span>
            </p>

            <input
              type="text"
              placeholder="6-digit code"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full bg-[#23233A] rounded-xl px-4 py-4 text-2xl text-center
                         text-white placeholder:text-white/30 outline-none focus:ring-1
                         focus:ring-vigor-violet tracking-[0.5em] mb-4"
              inputMode="numeric"
            />

            {error && <p className="text-burn-coral text-xs mb-4">{error}</p>}

            <button
              onClick={verifyOTP}
              disabled={loading || otp.length < 6}
              className="w-full bg-vigor-violet text-white rounded-2xl py-4 text-sm font-medium
                         disabled:opacity-40 active:scale-[0.98] mb-3"
            >
              {loading ? 'Verifying...' : 'Log in'}
            </button>
          </>
        )}
      </div>

      {process.env.NODE_ENV === 'development' && (
        <p className="text-xs text-white/20 mt-10 text-center">
          <a href="/dev-login" className="underline hover:text-white/40">
            Dev: skip OTP →
          </a>
        </p>
      )}
    </div>
  );
}
