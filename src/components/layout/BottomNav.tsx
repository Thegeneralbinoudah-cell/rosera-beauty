import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Home, Map, CalendarHeart, Heart, User } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'

const items = [
  { to: '/home', k: 'nav.home', Icon: Home, match: (p: string) => p === '/home' || p.startsWith('/region/') || p.startsWith('/city/') },
  { to: '/map', k: 'nav.map', Icon: Map, match: (p: string) => p.startsWith('/map') },
  { to: '/bookings', k: 'nav.bookings', Icon: CalendarHeart, match: (p: string) => p.startsWith('/bookings') },
  { to: '/favorites', k: 'nav.favorites', Icon: Heart, match: (p: string) => p.startsWith('/favorites') },
  { to: '/profile', k: 'nav.profile', Icon: User, match: (p: string) => p.startsWith('/profile') },
]

export function BottomNav() {
  const { pathname } = useLocation()
  const { t } = useI18n()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-primary/25 bg-white/90 pb-safe pt-2 shadow-nav backdrop-blur-xl dark:border-border dark:bg-rosera-dark/95">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1">
        {items.map(({ to, k, Icon, match }) => {
          const active = match(pathname)
          return (
            <NavLink
              key={to}
              to={to}
              onMouseEnter={() => {
                if (to === '/map') void import('@/pages/MapPage')
              }}
              onFocus={() => {
                if (to === '/map') void import('@/pages/MapPage')
              }}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold tracking-luxury-tight transition-all duration-200 active:scale-95',
                active ? 'text-[#BE185D]' : 'text-muted-foreground'
              )}
            >
              {active && (
                <motion.span
                  layoutId="navdot"
                  className="absolute -top-0.5 h-1 w-8 rounded-full bg-[#F9A8C9]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200',
                  active ? 'icon-circle-pink scale-100' : 'bg-transparent'
                )}
              >
                <Icon
                  className={cn('h-5 w-5 transition-transform duration-200', active ? 'text-[#BE185D]' : 'text-muted-foreground')}
                  strokeWidth={active ? 2.5 : 2}
                />
              </span>
              <span className="leading-tight text-center whitespace-nowrap">{t(k)}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
