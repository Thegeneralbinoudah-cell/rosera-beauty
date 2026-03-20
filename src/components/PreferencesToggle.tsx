import { Moon, Sun } from 'lucide-react'
import { usePreferences } from '@/contexts/PreferencesContext'

export default function PreferencesToggle() {
  const { dark, lang, toggleDark, setLang } = usePreferences()
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={toggleDark}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-white/90 text-primary dark:bg-card"
        aria-label={dark ? 'Light mode' : 'Dark mode'}
      >
        {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
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
