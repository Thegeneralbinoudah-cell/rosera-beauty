/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: '#F9A8C9',
          foreground: '#1F2937',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        luxury: {
          ink: '#1F2937',
          surface: '#FFFFFF',
          blush: '#FCE7F3',
        },
        destructive: { DEFAULT: '#EF4444', foreground: '#ffffff' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: '#EC4899', foreground: '#ffffff' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        success: '#10B981',
        rosera: {
          DEFAULT: '#F9A8C9',
          light: '#FFFFFF',
          dark: '#1A1A2E',
          purple: '#DB2777',
          pink: '#F9A8C9',
          rose: '#BE185D',
          text: '#1F2937',
          gray: '#6B7280',
        },
      },
      spacing: {
        18: '4.5rem',
        /** 16–20px — شاشات العميل */
        section: '1.25rem',
        'section-y': '1.25rem',
        'section-x': '1.125rem',
      },
      borderRadius: { lg: '12px', md: '10px', sm: '8px', xl: '16px' },
      fontFamily: {
        cairo: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
        display: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        luxury: '0.02em',
        'luxury-tight': '0.01em',
      },
      fontSize: {
        'body-sm': ['0.8125rem', { lineHeight: '1.5' }],
        body: ['0.9375rem', { lineHeight: '1.6' }],
        'title-sm': ['1.0625rem', { lineHeight: '1.35', fontWeight: '700' }],
        title: ['1.25rem', { lineHeight: '1.3', fontWeight: '700' }],
        display: ['1.5rem', { lineHeight: '1.25', fontWeight: '800' }],
      },
      keyframes: {
        'premium-in': {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'rosy-voice-wave': {
          '0%, 100%': { transform: 'scaleY(0.35)', opacity: '0.65' },
          '50%': { transform: 'scaleY(1)', opacity: '1' },
        },
      },
      animation: {
        'premium-in': 'premium-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        'rosy-voice-wave': 'rosy-voice-wave 0.52s ease-in-out infinite',
      },
      boxShadow: {
        soft: '0 2px 14px -2px rgba(249, 168, 201, 0.22), 0 4px 20px -6px rgba(31, 41, 55, 0.05)',
        card: '0 8px 32px -8px rgba(26, 26, 46, 0.12)',
        premium:
          '0 4px 20px -4px rgba(236, 72, 153, 0.22), 0 2px 8px -2px rgba(249, 168, 201, 0.35)',
        'luxury-sm': '0 1px 3px rgba(249, 168, 201, 0.12), 0 4px 14px -4px rgba(31, 41, 55, 0.06)',
        'luxury-md': '0 4px 16px -4px rgba(249, 168, 201, 0.25), 0 8px 24px -8px rgba(31, 41, 55, 0.08)',
        nav: '0 -8px 32px -8px rgba(249, 168, 201, 0.18), 0 -2px 12px rgba(31, 41, 55, 0.04)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    function ({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
      })
    },
  ],
}
