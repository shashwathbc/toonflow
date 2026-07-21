import type { Config } from 'tailwindcss'
import tailwindScrollbar from 'tailwind-scrollbar'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0F0F0F',
          card: '#1A1A1A',
          elevated: '#212121',
          // Decorative dividers/card edges — carries no meaning on its own.
          border: '#3F3F3F',
          // Boundaries that DO convey a control (inputs, selects, checkboxes).
          // WCAG 1.4.11 wants 3:1 against the adjacent surface; #3F3F3F only
          // manages 1.65:1 on bg-card, so controls use this instead.
          'border-strong': '#616161',
        },
        text: {
          DEFAULT: '#FFFFFF',
          secondary: '#AAAAAA',
          // Was #717171 — that failed WCAG AA on every surface we paint it on
          // (3.93:1 on bg, 3.57:1 on card, 3.30:1 on elevated; AA needs 4.5:1).
          // #8B8B8B clears it everywhere (5.63 / 5.11 / 4.73) and still reads
          // as the quietest step in the ramp.
          muted: '#8B8B8B',
        },
        accent: {
          DEFAULT: '#FFFFFF',
          hover: '#EBEBEB',
          foreground: '#0F0F0F',
          muted: 'rgba(255,255,255,0.08)',
        },
        danger: '#FF4444',
        warning: '#FFB800',
        success: '#2DCA72',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        // System monospace stack (no web font is loaded for mono).
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      backgroundImage: {
        'shimmer-gradient': 'linear-gradient(90deg, #1A1A1A 25%, #212121 50%, #1A1A1A 75%)',
        'hero-gradient': 'linear-gradient(to bottom, transparent 40%, #0F0F0F 100%)',
        'card-gradient': 'linear-gradient(145deg, #1E1E1E, #161616)',
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out',
        'slide-up': 'slide-up 0.25s ease-out',
        'slide-in-left': 'slide-in-left 0.25s ease-out',
        shimmer: 'shimmer 2s infinite linear',
        'scale-in': 'scale-in 0.15s ease-out',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      maxWidth: {
        editor: '900px',
      },
    },
  },
  plugins: [
    tailwindScrollbar({ nocompatible: true }),
  ],
}

export default config
