/** @type {import('tailwindcss').Config} */
/** ROSERA — design tokens (see src/index.css :root) */
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
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          hover: 'hsl(var(--primary-hover))',
          active: 'hsl(var(--primary-active))',
          subtle: 'hsl(var(--primary-subtle))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        gold: {
          DEFAULT: 'hsl(var(--gold))',
          foreground: 'hsl(var(--gold-foreground))',
          subtle: 'hsl(var(--gold-subtle))',
        },
        /** @deprecated Prefer foreground / card / accent — kept for gradual migration */
        luxury: {
          ink: 'hsl(var(--foreground))',
          surface: 'hsl(var(--card))',
          blush: 'hsl(var(--accent))',
        },
        /** Legacy aliases → semantic tokens */
        rosera: {
          DEFAULT: 'hsl(var(--primary))',
          light: 'hsl(var(--background))',
          dark: 'hsl(var(--background))',
          strong: 'hsl(var(--rose-strong))',
          purple: 'hsl(var(--rose-strong))',
          pink: 'hsl(var(--primary))',
          rose: 'hsl(var(--rose-strong))',
          text: 'hsl(var(--foreground))',
          gray: 'hsl(var(--muted-foreground))',
        },
        overlay: 'hsl(var(--overlay-scrim) / 0.5)',
      },
      spacing: {
        'ds-1': 'var(--space-1)',
        'ds-2': 'var(--space-2)',
        'ds-3': 'var(--space-3)',
        'ds-4': 'var(--space-4)',
        'ds-5': 'var(--space-5)',
        'ds-6': 'var(--space-6)',
        18: '4.5rem',
        'page-x': '1rem',
        'page-y': '1rem',
        section: '1.5rem',
        'section-y': '1.25rem',
        'section-x': '1.125rem',
        'card-inner': '1.25rem',
        'header-gap': '1.5rem',
        'list-gap': '0.75rem',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)',
      },
      fontFamily: {
        sans: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
        cairo: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
        display: ['Tajawal', 'Cairo', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        /** Typography scale — Arabic-first */
        'display-xl': ['2.25rem', { lineHeight: '1.12', letterSpacing: '-0.02em' }],
        display: ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        'heading-1': ['1.875rem', { lineHeight: '1.22', letterSpacing: '-0.015em' }],
        'heading-2': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        'heading-3': ['1.25rem', { lineHeight: '1.36', letterSpacing: '-0.01em' }],
        title: ['1.25rem', { lineHeight: '1.34' }],
        'title-sm': ['1.0625rem', { lineHeight: '1.38' }],
        body: ['0.9375rem', { lineHeight: '1.75', letterSpacing: '0.02em' }],
        'body-sm': ['0.8125rem', { lineHeight: '1.6', letterSpacing: '0.02em' }],
        caption: ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.03em' }],
        label: ['0.875rem', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        button: ['0.9375rem', { lineHeight: '1.25', letterSpacing: '0.02em' }],
      },
      letterSpacing: {
        luxury: '0.02em',
        'luxury-tight': '0.01em',
      },
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
        250: '250ms',
      },
      transitionTimingFunction: {
        'premium-out': 'var(--ease-out-premium)',
        'spring-soft': 'var(--ease-spring-soft)',
      },
      keyframes: {
        'page-enter': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'list-item-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'skeleton-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'rosy-voice-wave': {
          '0%, 100%': { transform: 'scaleY(0.35)', opacity: '0.65' },
          '50%': { transform: 'scaleY(1)', opacity: '1' },
        },
        'rosey-pulse-soft': {
          '0%, 100%': {
            filter: 'drop-shadow(0 0 18px rgba(244, 114, 182, 0.32)) drop-shadow(0 10px 22px rgba(190, 24, 93, 0.12))',
          },
          '50%': {
            filter: 'drop-shadow(0 0 26px rgba(251, 191, 36, 0.38)) drop-shadow(0 12px 26px rgba(244, 114, 182, 0.18))',
          },
        },
        'rosy-float-breathe': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '50%': { transform: 'translateY(-6px) scale(1.04)' },
        },
        'rosy-click-burst': {
          '0%': { transform: 'scale(0.55)', opacity: '0.9' },
          '100%': { transform: 'scale(2.35)', opacity: '0' },
        },
        'rosy-spark-fly': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-22px)', opacity: '0' },
        },
        'map-shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'page-enter': 'page-enter 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'premium-in': 'page-enter 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'list-item-in': 'list-item-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'skeleton-pulse': 'skeleton-pulse 1.4s cubic-bezier(0.22, 1, 0.36, 1) infinite',
        'rosy-voice-wave': 'rosy-voice-wave 0.52s ease-in-out infinite',
        'rosey-pulse-soft': 'rosey-pulse-soft 2.6s ease-in-out infinite',
        'rosy-float-breathe': 'rosy-float-breathe 3s ease-in-out infinite',
        'rosy-click-burst': 'rosy-click-burst 300ms ease-out forwards',
        'rosy-spark-fly': 'rosy-spark-fly 300ms ease-out forwards',
        'map-shimmer': 'map-shimmer 1.6s ease-in-out infinite',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        /** Semantic — prefer these in components */
        subtle: 'var(--shadow-subtle)',
        medium: 'var(--shadow-medium)',
        elevated: 'var(--shadow-elevated)',
        floating: 'var(--shadow-floating)',
        'inner-soft': 'var(--shadow-inner-soft)',
        nav: 'var(--shadow-nav)',
        soft: 'var(--shadow-sm)',
        card: 'var(--shadow-elevated)',
        premium: 'var(--shadow-floating)',
        'luxury-sm': 'var(--shadow-sm)',
        'luxury-md': 'var(--shadow-md)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    function ({ addUtilities }) {
      const staggerDelays = {}
      for (let i = 1; i <= 24; i++) {
        staggerDelays[`.motion-stagger > *:nth-child(${i})`] = {
          animationDelay: `${(i - 1) * 50}ms`,
        }
      }
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        '.motion-stagger > *': {
          animation: 'list-item-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both',
        },
        ...staggerDelays,
      })
    },
  ],
}
