import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        scalora: { blue: '#2563EB', purple: '#7C3AED', panel: '#111827', line: '#263244' }
      },
      boxShadow: {
        glow: '0 18px 50px rgba(37, 99, 235, 0.12)'
      }
    }
  },
  plugins: []
} satisfies Config;
