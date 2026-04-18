import VigorLogo from '@/components/VigorLogo';

export default function MobileOnlyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0D0D1A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
      <div style={{ marginBottom: 32 }}>
        <VigorLogo height={36} />
      </div>
      <h1 style={{ fontSize: 22, fontWeight: 500, color: '#fff', letterSpacing: '-0.02em', marginBottom: 12 }}>
        Open on your phone
      </h1>
      <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', maxWidth: 320, lineHeight: 1.6 }}>
        Vigor is built for mobile. Scan the QR code or open{' '}
        <strong style={{ color: 'rgba(255,255,255,0.65)' }}>joinvigor.co</strong>{' '}
        on your phone to get started.
      </p>
      <div style={{ marginTop: 40, padding: '32px', background: '#1A1A2E', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* QR placeholder — replace with real QR in production */}
        <div style={{ width: 120, height: 120, background: 'rgba(108,99,255,0.12)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
          QR code
        </div>
      </div>
    </div>
  );
}
