import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'deep-space': '#1A1A2E',
        'card-dark': '#23233A',
        'vigor-violet': '#6C63FF',
        'pulse-green': '#39D98A',
        'burn-coral': '#FF6B6B',
        'tempo-amber': '#FFD166',
        frost: '#F5F4FF',
        'light-surface': '#EEEEFF',
        tier: {
          bronze: '#CD7F32',
          silver: '#8A9BB5',
          gold: '#B8860B'
        }
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif']
      },
      letterSpacing: {
        hero: '-0.03em',
        label: '0.06em'
      }
    }
  },
  plugins: []
};

export default config;
