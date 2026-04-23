'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import VigorLogo from '@/components/VigorLogo';

const NAV = [
  {
    href: '/app/home',
    label: 'Explore',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="11" cy="11" r="7" stroke={active ? '#6C63FF' : '#555'} strokeWidth="2"/>
        <path d="M17 17L21 21" stroke={active ? '#6C63FF' : '#555'} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/app/activity',
    label: 'ActiVity',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 12L7 8L11 14L15 6L19 10L21 8" stroke={active ? '#6C63FF' : '#555'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/app/session',
    label: 'Session',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke={active ? '#6C63FF' : '#555'} strokeWidth="2"/>
        <path d="M9 9H9.01M9 15H9.01M15 9H15.01M15 15H15.01M7 12H17" stroke={active ? '#6C63FF' : '#555'} strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/app/wallet',
    label: 'Wallet',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="7" width="20" height="14" rx="3" stroke={active ? '#6C63FF' : '#555'} strokeWidth="2"/>
        <path d="M16 14A1 1 0 1 1 16.01 14" stroke={active ? '#6C63FF' : '#555'} strokeWidth="2" strokeLinecap="round"/>
        <path d="M6 7V5A2 2 0 0 1 18 5V7" stroke={active ? '#6C63FF' : '#555'} strokeWidth="2"/>
      </svg>
    ),
  },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ background: 'var(--color-deep-space)', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Vigor header bar */}
      <header style={{
        position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        padding: '14px 20px 10px',
        background: 'rgba(26,26,46,0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '0.5px solid rgba(255,255,255,0.06)',
        zIndex: 50,
        display: 'flex', alignItems: 'center',
      }}>
        <VigorLogo height={26} />
      </header>

      {/* Page content */}
      <main style={{ flex: 1, overflowY: 'auto', paddingTop: 54, paddingBottom: 72 }}>
        {children}
      </main>

      {/* Bottom navigation */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        background: 'rgba(20,20,38,0.97)',
        backdropFilter: 'blur(16px)',
        borderTop: '0.5px solid rgba(108,99,255,0.12)',
        padding: '10px 0 calc(10px + env(safe-area-inset-bottom))',
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, textDecoration: 'none', minWidth: 56 }}>
                {icon(active)}
                <span style={{ fontSize: 10, fontWeight: 500, color: active ? '#6C63FF' : '#555', letterSpacing: '0.02em' }}>
                  {label}
                </span>
                {active && <div style={{ width: 18, height: 2, background: '#6C63FF', borderRadius: 1 }} />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
