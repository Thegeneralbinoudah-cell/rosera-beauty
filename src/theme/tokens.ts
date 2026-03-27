/**
 * ROSERA design tokens — single source of truth for brand + layout primitives.
 * Tailwind continues to use `hsl(var(--*))` in tailwind.config.js; keep HSL in `index.css`
 * aligned with these hex/RGB values when updating themes.
 */

import { colors as themePalette } from './colors'

/** Core brand (hex) — extends `theme/colors.ts` with legacy aliases for charts, maps, and gradients. */
export const colors = {
  ...themePalette,
  primaryHover: themePalette.primaryHover,
  primaryActive: themePalette.primaryHover,
  primarySubtle: themePalette.secondary,
  foreground: themePalette.textPrimary,
  text: themePalette.textPrimary,
  card: themePalette.surface,
  muted: themePalette.secondary,
  mutedForeground: themePalette.textSecondary,
  input: themePalette.border,
  ring: themePalette.primary,
  white: '#FFFFFF',
  offWhite: themePalette.surface,
  cream: themePalette.surface2,
  goldForeground: themePalette.textPrimary,
  goldSubtle: themePalette.secondary,
  roseStrong: themePalette.mapPinTop,
  luxuryRoseWash: themePalette.surface2,
  luxuryMutedWash: themePalette.secondary,
  splashDustyRose: themePalette.mapPinRose,
  splashGoldMid: themePalette.accent,
  chartPrimary: themePalette.primary,
  chartAccent: themePalette.accent,
  chartRevenue: themePalette.primary,
  mapUserBlue: themePalette.mapUserBlue,
  mapPinNeutral: themePalette.mapPinNeutral,
  mapPinGold: themePalette.mapPinBoost,
  mapPinRose: themePalette.mapPinRose,
  mapPinTop: themePalette.mapPinTop,
  mapPinBoost: themePalette.mapPinBoost,
  mapPinSuggestion: themePalette.mapPinSuggestion,
  nailFallback: themePalette.mapPinRose,
  neutral400: themePalette.textSecondary,
  neutral600: themePalette.textPrimary,
  revenueTint: themePalette.success,
} as const

/**
 * Space-separated RGB triplets for `rgb(var(--rose-rgb) / <alpha>)` in CSS or canvas.
 */
export const rgb = {
  /** Brand pink — aligns with #f472b6 */
  rose: '244 114 182',
  /** Accent gold — aligns with #fbbf24 */
  gold: '251 191 36',
} as const

export const radius = {
  sm: '0.5rem',
  md: '0.625rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.25rem',
  '3xl': '1.75rem',
  full: '9999px',
} as const

/** Design-system spacing scale (rem) — mirrors `--space-*` in index.css */
export const spacing = {
  px: '1px',
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.5rem',
  6: '2rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  pageX: '1rem',
  pageY: '1rem',
  section: '1.5rem',
  cardInner: '1.25rem',
} as const

/** Elevation — pink / gold bloom (matches `--shadow-*` in index.css) */
export const shadows = {
  xs: `0 1px 2px rgb(0 0 0 / 0.04)`,
  sm: `0 4px 18px rgb(${rgb.rose} / 0.14), 0 2px 8px rgb(0 0 0 / 0.045)`,
  md: `0 10px 28px rgb(${rgb.rose} / 0.2), 0 4px 14px rgb(${rgb.gold} / 0.08)`,
  lg: `0 18px 44px rgb(${rgb.rose} / 0.24), 0 8px 22px rgb(${rgb.gold} / 0.14)`,
  xl: `0 24px 52px rgb(0 0 0 / 0.07), 0 0 36px rgb(${rgb.gold} / 0.2)`,
  elevated: `0 10px 28px rgb(${rgb.rose} / 0.2), 0 4px 14px rgb(${rgb.gold} / 0.08)`,
  floating: `0 18px 44px rgb(${rgb.rose} / 0.24), 0 8px 22px rgb(${rgb.gold} / 0.14)`,
  nav: `0 -8px 32px rgb(0 0 0 / 0.06), 0 0 24px rgb(${rgb.rose} / 0.08)`,
  innerSoft: 'inset 0 1px 0 hsl(0 0% 100% / 0.7)',
  primaryCta: `0 6px 20px rgb(${rgb.rose} / 0.35), 0 2px 8px rgb(${rgb.gold} / 0.2)`,
} as const

export const gradients = {
  /** Primary marketing gradient (pink → gold) */
  primary: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.accent} 100%)`,
  /** Same intent using CSS variables (for global CSS layers) */
  primaryFromVars: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--gold)) 100%)',
  /** Splash / auth hero */
  splashScreen: `linear-gradient(168deg, ${colors.background} 0%, ${colors.secondary} 42%, ${colors.primary} 72%, ${colors.accentLight} 100%)`,
  /** `.luxury-bg` layered canvas */
  luxuryBg: `radial-gradient(circle at top right, ${colors.luxuryRoseWash} 0%, transparent 40%), radial-gradient(circle at bottom left, ${colors.luxuryMutedWash} 0%, transparent 50%), ${colors.background}`,
} as const

export const motion = {
  easeOutPremium: 'cubic-bezier(0.22, 1, 0.36, 1)',
  easeSpringSoft: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  durationFast: '150ms',
  durationNormal: '200ms',
  durationSlow: '300ms',
} as const

/** Aggregated export for consumers that want one import */
export const theme = {
  colors,
  rgb,
  radius,
  spacing,
  shadows,
  gradients,
  motion,
} as const

export type ThemeColors = keyof typeof colors
