import { usePreferences } from '@/contexts/PreferencesContext'
import { tr } from '@/lib/i18n'

export function useI18n() {
  const { lang } = usePreferences()
  return {
    lang,
    t: (key: string, vars?: Record<string, string | number>) => tr(lang, key, vars),
  }
}
