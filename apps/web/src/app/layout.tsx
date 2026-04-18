import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Vigor — Your Fitness Everywhere',
  description: 'Token-based fitness marketplace. Access any gym, anytime.',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Vigor' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1A1A2E',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#0D0D1A] text-white antialiased">
        {children}
      </body>
    </html>
  );
}
