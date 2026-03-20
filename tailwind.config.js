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
          DEFAULT: '#E91E8C',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: { DEFAULT: '#EF4444', foreground: '#ffffff' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: '#9C27B0', foreground: '#ffffff' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        success: '#10B981',
        rosera: {
          DEFAULT: '#9B2257',
          light: '#FCE4EC',
          dark: '#1A1A2E',
          purple: '#9C27B0',
          pink: '#E91E8C',
          rose: '#9B2257',
          text: '#1F1F1F',
          gray: '#6B7280',
        },
      },
      spacing: {
        18: '4.5rem',
      },
      borderRadius: { lg: '12px', md: '10px', sm: '8px', xl: '16px' },
      fontFamily: { cairo: ['Tajawal', 'Cairo', 'sans-serif'] },
      boxShadow: {
        soft: '0 4px 24px -4px rgba(233, 30, 140, 0.12)',
        card: '0 8px 32px -8px rgba(26, 26, 46, 0.12)',
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
