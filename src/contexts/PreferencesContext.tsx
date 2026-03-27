import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { STORAGE_KEYS } from '@/lib/utils'
import { persistThemeMode, THEME_MODE_KEY } from '@/lib/themeStorage'

type Lang = 'ar' | 'en'

function readInitialLang(): Lang {
  if (typeof window === 'undefined') return 'ar'
  const savedLang = (localStorage.getItem(STORAGE_KEYS.lang) as Lang | null) ?? 'ar'
  return savedLang === 'en' ? 'en' : 'ar'
}

function readInitialDark(): boolean {
  if (typeof window === 'undefined') return false
  const themeMode = localStorage.getItem(THEME_MODE_KEY)
  const legacyDark = localStorage.getItem(STORAGE_KEYS.dark)
  if (themeMode === 'dark') return true
  if (themeMode === 'light') return false
  return legacyDark === '1'
}

type PreferencesContextType = {
  dark: boolean
  lang: Lang
  setDark: (value: boolean) => void
  setLang: (value: Lang) => void
  toggleDark: () => void
}

const PreferencesContext = createContext<PreferencesContextType | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(readInitialDark)
  const [lang, setLangState] = useState<Lang>(readInitialLang)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(STORAGE_KEYS.dark, dark ? '1' : '')
    void persistThemeMode(dark)
  }, [dark])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem(STORAGE_KEYS.lang, lang)
  }, [lang])

  const value = useMemo(
    () => ({
      dark,
      lang,
      setDark: (v: boolean) => setDarkState(v),
      setLang: (v: Lang) => setLangState(v),
      toggleDark: () => setDarkState((x) => !x),
    }),
    [dark, lang]
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx) throw new Error('usePreferences must be used inside PreferencesProvider')
  return ctx
}
