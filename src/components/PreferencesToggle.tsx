import { DarkModeToggle } from '@/components/DarkModeToggle'
import { usePreferences } from '@/contexts/PreferencesContext'

/** Dark mode + language — same row as notifications in headers that use this component. */
export default function PreferencesToggle() {
  const { lang, setLang } = usePreferences()
  return (
    <div className="flex items-center gap-2">
      <DarkModeToggle />
      <button
        type="button"
        onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
        className="rounded-full border border-primary/20 bg-white/90 px-3 py-1.5 text-xs font-bold text-primary dark:bg-card"
      >
        {lang === 'ar' ? 'EN' : 'AR'}
      </button>
    </div>
  )
}
