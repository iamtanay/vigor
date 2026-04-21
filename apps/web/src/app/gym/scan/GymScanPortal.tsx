'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Venue {
  id: string;
  name: string;
  tier: string;
}

interface ScanResult {
  type: 'entry' | 'exit';
  success: boolean;
  userName: string;
  venueName: string;
  message: string;
  durationMins?: number;
  tokensDeducted?: number;
  isPeak?: boolean;
  newBalance?: number;
  error?: string;
}

type ScanMode = 'idle' | 'scanning' | 'processing' | 'result' | 'error';

export default function GymScanPortal({ ownerName, venue }: { ownerName: string; venue: Venue | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jsQRRef = useRef<any>(null);

  const [mode, setMode] = useState<ScanMode>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [jsQRLoaded, setJsQRLoaded] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<Array<{ type: string; name: string; time: string; tokens?: number }>>([]);
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);

  // Load jsQR library
  useEffect(() => {
    if ((window as any).jsQR) {
      jsQRRef.current = (window as any).jsQR;
      setJsQRLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';
    script.onload = () => {
      jsQRRef.current = (window as any).jsQR;
      setJsQRLoaded(true);
    };
    script.onerror = () => setCameraError('Failed to load QR scanner library');
    document.head.appendChild(script);
  }, []);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setMode('scanning');
    setLastScanned(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access.'
          : 'Camera not available. Use manual input below.'
      );
      setMode('idle');
      setShowManual(true);
      return;
    }

    // Scan loop
    scanIntervalRef.current = setInterval(() => {
      if (!videoRef.current || !canvasRef.current || !jsQRRef.current) return;
      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQRRef.current(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data && code.data !== lastScanned) {
        setLastScanned(code.data);
        handleQRDetected(code.data);
      }
    }, 250);
  }, [lastScanned]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleQRDetected(qrString: string) {
    if (!qrString.startsWith('vigor:')) return;
    stopCamera();
    setMode('processing');

    try {
      const res = await fetch('/api/sessions/validate-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrString, scanMethod: 'staff' }),
      });
      const data = await res.json();

      if (!res.ok) {
        setScanResult({ ...data, success: false, type: qrString.includes(':entry:') ? 'entry' : 'exit', userName: '', venueName: '', message: data.error || 'Scan failed' });
        setMode('error');
      } else {
        setScanResult(data);
        setMode('result');
        // Add to recent scans
        setRecentScans(prev => [{
          type: data.type,
          name: data.userName,
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          tokens: data.tokensDeducted,
        }, ...prev.slice(0, 9)]);
      }
    } catch (err) {
      setScanResult({ type: 'entry', success: false, userName: '', venueName: '', message: 'Network error — please try again' });
      setMode('error');
    }
  }

  function resetToIdle() {
    setScanResult(null);
    setLastScanned(null);
    setMode('idle');
    setManualInput('');
  }

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-deep-space)', fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        background: 'rgba(26,26,46,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#fff' }}>
            {venue?.name ?? 'Scan Portal'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
            {ownerName} · Gym Staff
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/gym" style={{
            fontSize: 12, color: '#6C63FF', textDecoration: 'none',
            padding: '6px 12px', border: '1px solid rgba(108,99,255,0.3)',
            borderRadius: 20,
          }}>Dashboard</Link>
        </div>
      </div>

      <div style={{ maxWidth: 500, margin: '0 auto', padding: '20px' }}>
        {/* IDLE state */}
        {mode === 'idle' && (
          <div>
            {cameraError && (
              <div style={{
                background: 'rgba(255,107,107,0.1)',
                border: '1px solid rgba(255,107,107,0.3)',
                borderRadius: 12, padding: '12px 14px',
                color: '#FF6B6B', fontSize: 13, marginBottom: 16,
              }}>
                {cameraError}
              </div>
            )}

            <button
              onClick={startCamera}
              disabled={!jsQRLoaded}
              style={{
                width: '100%', padding: '18px',
                background: jsQRLoaded ? '#6C63FF' : '#333',
                color: '#fff', border: 'none', borderRadius: 16,
                fontSize: 16, fontWeight: 500, cursor: jsQRLoaded ? 'pointer' : 'not-allowed',
                marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <span style={{ fontSize: 22 }}>📷</span>
              {jsQRLoaded ? 'Scan QR Code' : 'Loading scanner…'}
            </button>

            <button
              onClick={() => setShowManual(!showManual)}
              style={{
                width: '100%', padding: '12px',
                background: 'transparent',
                color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, fontSize: 13, cursor: 'pointer',
                marginBottom: 20,
              }}
            >
              {showManual ? 'Hide' : 'Use manual QR input'}
            </button>

            {showManual && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                  Paste QR string manually (for testing):
                </div>
                <textarea
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  placeholder="vigor:entry:... or vigor:exit:..."
                  style={{
                    width: '100%', background: 'var(--color-card-dark)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, padding: '10px 12px',
                    color: '#fff', fontSize: 12, fontFamily: 'monospace',
                    resize: 'vertical', minHeight: 80, boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={() => manualInput.trim() && handleQRDetected(manualInput.trim())}
                  disabled={!manualInput.trim()}
                  style={{
                    width: '100%', marginTop: 8, padding: '12px',
                    background: manualInput.trim() ? '#6C63FF' : '#333',
                    color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: 14, cursor: manualInput.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Validate QR
                </button>
              </div>
            )}

            {/* Recent scans */}
            {recentScans.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.4)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Recent scans
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {recentScans.map((s, i) => (
                    <div key={i} style={{
                      background: 'var(--color-card-dark)',
                      borderRadius: 10, padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 18 }}>{s.type === 'entry' ? '🟢' : '🔴'}</span>
                        <div>
                          <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                            {s.type === 'entry' ? 'Checked in' : `Checked out · ${s.tokens} tokens`} · {s.time}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 8 }}>
                        {s.type}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SCANNING state */}
        {mode === 'scanning' && (
          <div>
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', marginBottom: 16, background: '#000' }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', display: 'block', maxHeight: 350, objectFit: 'cover' }}
              />
              {/* Scan overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: 200, height: 200,
                  border: '2px solid #6C63FF',
                  borderRadius: 16,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                  position: 'relative',
                }}>
                  {/* Corner marks */}
                  {[
                    { top: -2, left: -2, borderTop: '3px solid #6C63FF', borderLeft: '3px solid #6C63FF' },
                    { top: -2, right: -2, borderTop: '3px solid #6C63FF', borderRight: '3px solid #6C63FF' },
                    { bottom: -2, left: -2, borderBottom: '3px solid #6C63FF', borderLeft: '3px solid #6C63FF' },
                    { bottom: -2, right: -2, borderBottom: '3px solid #6C63FF', borderRight: '3px solid #6C63FF' },
                  ].map((style, i) => (
                    <div key={i} style={{ position: 'absolute', width: 20, height: 20, borderRadius: 3, ...style }} />
                  ))}
                  {/* Scan line animation */}
                  <div style={{
                    position: 'absolute', left: 4, right: 4, height: 2,
                    background: 'linear-gradient(90deg, transparent, #6C63FF, transparent)',
                    animation: 'scanline 2s ease-in-out infinite',
                    top: '50%',
                  }} />
                </div>
              </div>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>
                Point camera at user's QR code
              </div>
            </div>

            <button
              onClick={() => { stopCamera(); setMode('idle'); }}
              style={{
                width: '100%', padding: '12px',
                background: 'rgba(255,107,107,0.15)',
                color: '#FF6B6B',
                border: '1px solid rgba(255,107,107,0.3)',
                borderRadius: 12, fontSize: 14, cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <style>{`
              @keyframes scanline {
                0%, 100% { top: 10%; }
                50% { top: 85%; }
              }
            `}</style>
          </div>
        )}

        {/* PROCESSING state */}
        {mode === 'processing' && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#fff', marginBottom: 8 }}>Processing scan…</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Validating QR signature</div>
          </div>
        )}

        {/* SUCCESS result */}
        {mode === 'result' && scanResult && (
          <div className="card-enter" style={{ textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: scanResult.type === 'entry' ? 'rgba(57,217,138,0.15)' : 'rgba(108,99,255,0.15)',
              border: `2px solid ${scanResult.type === 'entry' ? 'rgba(57,217,138,0.4)' : 'rgba(108,99,255,0.4)'}`,
              margin: '0 auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36,
            }}>
              {scanResult.type === 'entry' ? '✅' : '🏁'}
            </div>

            <div style={{ fontSize: 22, fontWeight: 500, color: '#fff', marginBottom: 6 }}>
              {scanResult.type === 'entry' ? 'Entry Recorded' : 'Exit Recorded'}
            </div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 28 }}>
              {scanResult.userName}
            </div>

            {/* Stats */}
            <div style={{
              background: 'var(--color-card-dark)',
              borderRadius: 16, padding: 20,
              marginBottom: 24, textAlign: 'left',
            }}>
              {scanResult.type === 'entry' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 24 }}>🟢</span>
                  <div>
                    <div style={{ fontSize: 14, color: '#39D98A', fontWeight: 500 }}>Checked in successfully</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      Entry logged · Session started
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {[
                    { label: 'Duration', value: scanResult.durationMins ? `${Math.floor(scanResult.durationMins / 60)}h ${scanResult.durationMins % 60}m` : '—' },
                    { label: 'Tokens deducted', value: `${scanResult.tokensDeducted ?? 0}`, color: '#FF6B6B' },
                    { label: 'Rate', value: scanResult.isPeak ? '🔴 Peak (1.5×)' : '🟢 Off-peak (1.0×)' },
                  ].map((item, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: i < 2 ? '0.5px solid rgba(255,255,255,0.07)' : 'none',
                    }}>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 500, color: (item as any).color || '#fff' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => { resetToIdle(); setTimeout(startCamera, 100); }}
              style={{
                width: '100%', padding: '14px',
                background: '#6C63FF',
                color: '#fff', border: 'none', borderRadius: 14,
                fontSize: 15, fontWeight: 500, cursor: 'pointer',
                marginBottom: 10,
              }}
            >
              Scan next
            </button>
            <button
              onClick={resetToIdle}
              style={{
                width: '100%', padding: '12px',
                background: 'transparent',
                color: 'rgba(255,255,255,0.4)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, fontSize: 14, cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* ERROR result */}
        {mode === 'error' && scanResult && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'rgba(255,107,107,0.15)',
              border: '2px solid rgba(255,107,107,0.4)',
              margin: '40px auto 20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36,
            }}>
              ✕
            </div>
            <div style={{ fontSize: 20, fontWeight: 500, color: '#FF6B6B', marginBottom: 8 }}>Scan Failed</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>
              {scanResult.message}
            </div>
            <button
              onClick={() => { resetToIdle(); setTimeout(startCamera, 100); }}
              style={{
                width: '100%', padding: '14px',
                background: '#6C63FF', color: '#fff',
                border: 'none', borderRadius: 14,
                fontSize: 15, fontWeight: 500, cursor: 'pointer',
                marginBottom: 10,
              }}
            >
              Try again
            </button>
            <button onClick={resetToIdle} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
