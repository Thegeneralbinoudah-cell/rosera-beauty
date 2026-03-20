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
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-primary/10 bg-white/95 pb-safe pt-2 shadow-[0_-4px_24px_-4px_rgba(233,30,140,0.08)] backdrop-blur-md dark:bg-rosera-dark/95">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1">
        {items.map(({ to, k, Icon, match }) => {
          const active = match(pathname)
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-bold transition-colors',
                active ? 'text-[#E91E8C]' : 'text-rosera-gray'
              )}
            >
              {active && (
                <motion.span
                  layoutId="navdot"
                  className="absolute -top-0.5 h-1 w-8 rounded-full bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={cn('h-5 w-5', active && 'text-[#E91E8C]')} strokeWidth={active ? 2.5 : 2} />
              <span className="leading-tight text-center whitespace-nowrap">{t(k)}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
