import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { STORAGE_KEYS } from '@/lib/utils'

type Lang = 'ar' | 'en'

type PreferencesContextType = {
  dark: boolean
  lang: Lang
  setDark: (value: boolean) => void
  setLang: (value: Lang) => void
  toggleDark: () => void
}

const PreferencesContext = createContext<PreferencesContextType | null>(null)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState(false)
  const [lang, setLangState] = useState<Lang>('ar')

  useEffect(() => {
    const savedDark = localStorage.getItem(STORAGE_KEYS.dark)
    const savedLang = (localStorage.getItem(STORAGE_KEYS.lang) as Lang | null) ?? 'ar'
    const initialDark = savedDark === '1'
    setDarkState(initialDark)
    setLangState(savedLang === 'en' ? 'en' : 'ar')
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem(STORAGE_KEYS.dark, dark ? '1' : '')
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
