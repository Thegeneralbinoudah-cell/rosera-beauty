import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { STORAGE_KEYS } from '@/lib/utils'
import { colors, gradients } from '@/theme/tokens'

const SPLASH_MS = 1500

/** Minimal rose-inspired “R” monogram — stroke + soft petal hint */
function RoseRMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 132"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="splashRMonogram" x1="18" y1="12" x2="102" y2="118" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors.offWhite} />
          <stop offset="1" stopColor={colors.cream} />
        </linearGradient>
      </defs>
      {/* Whisper petals — sit behind the letter */}
      <ellipse cx="86" cy="78" rx="24" ry="20" transform="rotate(-32 86 78)" fill="white" opacity="0.1" />
      <ellipse cx="70" cy="98" rx="18" ry="15" transform="rotate(18 70 98)" fill="white" opacity="0.08" />
      {/* R — stem + bowl + leg */}
      <path d="M 40 28 L 40 112" stroke="url(#splashRMonogram)" strokeWidth="9" strokeLinecap="round" />
      <path
        d="M 40 28 C 74 28 90 46 90 60 C 90 76 68 86 40 82 M 54 86 L 92 118"
        stroke="url(#splashRMonogram)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

export default function SplashScreen() {
  const nav = useNavigate()
  const { user } = useAuth()
  const reduceMotion = useReducedMotion()
  const isGuest = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.guest) && !user

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (user || isGuest) {
        nav('/home', { replace: true })
      } else {
        nav('/onboarding', { replace: true })
      }
    }, SPLASH_MS)
    return () => clearTimeout(t)
  }, [nav, user, isGuest])

  return (
    <div
      className="fixed inset-0 z-splash flex min-h-dvh flex-col items-center justify-center px-8"
      style={{ background: gradients.splashScreen }}
      role="presentation"
    >
      <motion.div
        initial={
          reduceMotion
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.94, y: 8 }
        }
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.68, ease: [0.22, 1, 0.36, 1] }
        }
        className="flex flex-col items-center text-center"
      >
        <RoseRMark className="h-28 w-28 shrink-0 drop-shadow-[0_12px_36px_rgba(0,0,0,0.12)] sm:h-32 sm:w-32" />
        <p className="mt-8 max-w-[16rem] font-cairo text-[0.9375rem] font-medium leading-relaxed tracking-wide text-white/92 sm:text-base">
          روزي — مساعدك الذكي للجمال
        </p>
      </motion.div>
    </div>
  )
}
