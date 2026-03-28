import { usePreferences } from '@/contexts/PreferencesContext'
import { IoMoonOutline, IoSunnyOutline } from 'react-icons/io5'
import { cn } from '@/lib/utils'

/**
 * Ionicons-style: sunny-outline (light UI) / moon-outline (dark UI).
 * 36×36px, spec backgrounds — global placement via `GlobalThemeToggle`.
 */
export function DarkModeToggle({ className }: { className?: string }) {
  const { dark, toggleDark } = usePreferences()

  return (
    <button
      type="button"
      onClick={toggleDark}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={cn(
        'flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-primary/25 transition-opacity hover:opacity-90 active:scale-[0.98]',
        className
      )}
      style={{
        backgroundColor: dark ? 'hsl(var(--popover))' : 'hsl(var(--card))',
      }}
    >
      {dark ? (
        <IoMoonOutline className="h-[18px] w-[18px] text-foreground" aria-hidden />
      ) : (
        <IoSunnyOutline className="h-[18px] w-[18px] text-primary" aria-hidden />
      )}
    </button>
  )
}
