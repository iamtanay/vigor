'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';

type Step = 'phone' | 'otp';

export default function UserLoginPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function sendOTP() {
    setLoading(true);
    setError(null);

    // Normalise to E.164
    const e164 = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;

    const { error } = await supabase.auth.signInWithOtp({
      phone: e164,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStep('otp');
    }
  }

  async function verifyOTP() {
    setLoading(true);
    setError(null);

    const e164 = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;

    const { data, error } = await supabase.auth.verifyOtp({
      phone: e164,
      token: otp,
      type: 'sms',
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Upsert user record linked to auth user
    if (data.user) {
      await supabase.from('users').upsert({
        auth_id: data.user.id,
        phone: e164,
        role: 'user',
      }, { onConflict: 'auth_id' });
    }

    router.push('/app');
  }

  return (
    <div className="min-h-screen bg-[#0D0D1A] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-[#1A1A2E] rounded-xl flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <path d="M6 22 L14 6 L22 22" stroke="#6C63FF" strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9.5 15.5 L18.5 15.5" stroke="#39D98A" strokeWidth="2.5"
                    strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-2xl font-medium tracking-[-0.03em]">
            <span className="text-vigor-violet">V</span>igor
          </span>
        </div>

        {step === 'phone' ? (
          <>
            <h1 className="text-[28px] font-medium tracking-[-0.03em] mb-2">
              Enter your number
            </h1>
            <p className="text-sm text-white/40 mb-8">
              We'll send a one-time code to verify it's you.
            </p>

            <div className="flex gap-2 mb-4">
              <div className="bg-[#23233A] rounded-xl px-4 py-3 text-sm text-white/50 flex items-center">
                +91
              </div>
              <input
                type="tel"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="flex-1 bg-[#23233A] rounded-xl px-4 py-3 text-sm text-white
                           placeholder:text-white/30 outline-none focus:ring-1 focus:ring-vigor-violet"
                maxLength={10}
                inputMode="numeric"
              />
            </div>

            {error && <p className="text-burn-coral text-xs mb-4">{error}</p>}

            <button
              onClick={sendOTP}
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              className="w-full bg-vigor-violet text-white rounded-2xl py-4 text-sm font-medium
                         disabled:opacity-40 transition-opacity active:scale-[0.98]"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <h1 className="text-[28px] font-medium tracking-[-0.03em] mb-2">
              Enter the code
            </h1>
            <p className="text-sm text-white/40 mb-8">
              Sent to +91 {phone}
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
                         disabled:opacity-40 transition-opacity active:scale-[0.98] mb-3"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>

            <button
              onClick={() => { setStep('phone'); setError(null); setOtp(''); }}
              className="w-full text-white/40 text-sm py-2"
            >
              ← Change number
            </button>
          </>
        )}
      </div>
    </div>
  );
}
