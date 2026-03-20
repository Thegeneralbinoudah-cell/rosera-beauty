import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { STORAGE_KEYS } from '@/lib/utils'
import { ROSERA_LOGO_SRC } from '@/lib/branding'

export default function Splash() {
  const nav = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem(STORAGE_KEYS.appLaunched, '1')
      if (!localStorage.getItem(STORAGE_KEYS.onboarding)) nav('/onboarding', { replace: true })
      else nav('/', { replace: true })
    }, 2500)
    return () => clearTimeout(t)
  }, [nav])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gradient-rosera px-6 text-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center"
      >
        <img src={ROSERA_LOGO_SRC} alt="" className="mx-auto w-18 h-18 rounded-2xl object-contain" />
        <h1 className="mt-4 text-5xl font-extrabold tracking-tight">روزيرا</h1>
        <p className="mt-4 max-w-xs text-lg font-medium text-white/90 leading-relaxed">
          اكتشفي أفضل صالونات ومراكز التجميل
        </p>
      </motion.div>
    </div>
  )
}
