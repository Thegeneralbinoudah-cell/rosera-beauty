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
    <nav
      className="fixed bottom-0 inset-x-0 z-50 border-t border-primary/15 bg-card/95 pb-safe pt-2 shadow-nav backdrop-blur-xl"
      aria-label={t('nav.main')}
    >
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
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-normal tracking-luxury-tight transition-opacity duration-slow active:opacity-90',
                active ? 'text-primary font-semibold' : 'text-muted-foreground'
              )}
            >
              {active && (
                <motion.span
                  layoutId="navdot"
                  className="absolute -top-1 inset-x-0 mx-auto h-1.5 w-1.5 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <motion.span
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 ease-out',
                  active ? 'bg-primary/20' : 'bg-transparent'
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-colors duration-300 ease-out',
                    active ? 'text-primary' : 'text-muted-foreground'
                  )}
                  strokeWidth={1.25}
                />
              </motion.span>
              <span className="leading-tight text-center whitespace-nowrap">{t(k)}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
