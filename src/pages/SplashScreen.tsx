import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { STORAGE_KEYS } from '@/lib/utils'
import { ROSERA_LOGO_SRC } from '@/lib/branding'
import { LazyImage } from '@/components/ui/lazy-image'

export default function SplashScreen() {
  const nav = useNavigate()
  const { user } = useAuth()
  const isGuest = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEYS.guest) && !user

  useEffect(() => {
    const t = setTimeout(() => {
      if (user || isGuest) {
        nav('/home', { replace: true })
      } else {
        nav('/onboarding', { replace: true })
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [nav, user, isGuest])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-white"
      style={{ background: 'linear-gradient(135deg, #E91E8C 0%, #9C27B0 100%)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="text-center"
      >
        <LazyImage
          src={ROSERA_LOGO_SRC}
          alt=""
          className="mx-auto w-18 h-18 rounded-2xl object-contain"
          priority
        />
        <h1 className="mt-4 text-5xl font-extrabold tracking-tight">روزيرا</h1>
        <p className="mt-4 max-w-xs text-lg font-medium text-white/95 leading-relaxed">
          جمالك يبدأ من هنا
        </p>
      </motion.div>
    </div>
  )
}
