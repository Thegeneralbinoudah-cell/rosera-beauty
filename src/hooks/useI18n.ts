import { useCallback } from 'react'
import { usePreferences } from '@/contexts/PreferencesContext'
import { tr } from '@/lib/i18n'

export function useI18n() {
  const { lang } = usePreferences()
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => tr(lang, key, vars),
    [lang]
  )
  return { lang, t }
}
