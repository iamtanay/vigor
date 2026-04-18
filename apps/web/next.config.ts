import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@vigor/ui', '@vigor/lib', '@vigor/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'placehold.co' },
    ],
  },
  // Silence "missing manifest.json" warning in dev
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
    ];
  },
};

export default config;
