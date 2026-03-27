/** Web: mirrors AsyncStorage `themeMode` key for Capacitor / RN parity. */
export const THEME_MODE_KEY = 'themeMode' as const

export type ThemeModePref = 'dark' | 'light'

export async function persistThemeMode(isDark: boolean): Promise<void> {
  const value: ThemeModePref = isDark ? 'dark' : 'light'
  try {
    if (typeof localStorage !== 'undefined') {
      await Promise.resolve(localStorage.setItem(THEME_MODE_KEY, value))
    }
  } catch {
    /* ignore quota / private mode */
  }
}
