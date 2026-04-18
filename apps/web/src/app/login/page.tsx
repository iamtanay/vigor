'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { useRouter } from 'next/navigation';
import VigorLogo from '@/components/VigorLogo';

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
    setLoading(true); setError(null);
    const e164 = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setLoading(false);
    if (error) setError(error.message);
    else setStep('otp');
  }

  async function verifyOTP() {
    setLoading(true); setError(null);
    const e164 = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const { data, error } = await supabase.auth.verifyOtp({ phone: e164, token: otp, type: 'sms' });
    if (error) { setLoading(false); setError(error.message); return; }
    if (data.user) {
      await supabase.from('users').upsert({ auth_id: data.user.id, phone: e164, role: 'user' }, { onConflict: 'auth_id' });
    }
    router.push('/app/home');
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0D0D1A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>

        <div style={{ marginBottom: 36 }}>
          <VigorLogo height={34} />
        </div>

        {step === 'phone' ? (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 500, color: '#fff', letterSpacing: '-0.03em', marginBottom: 8 }}>
              Enter your number
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>
              We'll send a one-time code to verify it's you.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ background: '#23233A', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                +91
              </div>
              <input
                type="tel" placeholder="10-digit mobile number"
                value={phone} onChange={e => setPhone(e.target.value)}
                maxLength={10} inputMode="numeric"
                style={{ flex: 1, background: '#23233A', borderRadius: 12, padding: '12px 14px', fontSize: 14, color: '#fff', border: 'none', outline: 'none' }}
              />
            </div>
            {error && <p style={{ fontSize: 12, color: '#FF6B6B', marginBottom: 12 }}>{error}</p>}
            <button
              onClick={sendOTP}
              disabled={loading || phone.replace(/\D/g, '').length < 10}
              style={{ width: '100%', background: '#6C63FF', borderRadius: 14, padding: '15px', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Sending…' : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 500, color: '#fff', letterSpacing: '-0.03em', marginBottom: 8 }}>
              Enter the code
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 28 }}>
              Sent to +91 {phone}
            </p>
            <input
              type="text" placeholder="6-digit code"
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              style={{ width: '100%', background: '#23233A', borderRadius: 12, padding: '16px', fontSize: 24, textAlign: 'center', color: '#fff', border: 'none', outline: 'none', letterSpacing: '0.4em', marginBottom: 14 }}
            />
            {error && <p style={{ fontSize: 12, color: '#FF6B6B', marginBottom: 12 }}>{error}</p>}
            <button
              onClick={verifyOTP} disabled={loading || otp.length < 6}
              style={{ width: '100%', background: '#6C63FF', borderRadius: 14, padding: '15px', color: '#fff', fontSize: 15, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1, marginBottom: 12 }}
            >
              {loading ? 'Verifying…' : 'Verify'}
            </button>
            <button onClick={() => { setStep('phone'); setError(null); setOtp(''); }} style={{ width: '100%', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer', padding: 8 }}>
              ← Change number
            </button>
          </>
        )}
      </div>

      {process.env.NODE_ENV === 'development' && (
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 40 }}>
          <a href="/dev-login" style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline' }}>Dev: skip OTP →</a>
        </p>
      )}
    </div>
  );
}
