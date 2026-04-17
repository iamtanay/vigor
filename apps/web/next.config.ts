import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@vigor/ui', '@vigor/lib', '@vigor/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'placehold.co' }
    ]
  }
};

export default config;
