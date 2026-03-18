import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { STORAGE_KEYS } from '@/lib/utils'

const slides = [
  {
    title: 'اكتشفي أفضل الصالونات',
    img: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
    emoji: '💅',
  },
  {
    title: 'احجزي موعدك بسهولة',
    img: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
    emoji: '📅',
  },
  {
    title: 'مساعدتك الذكية روزيرا',
    img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800',
    emoji: '🤖',
  },
]

export default function Onboarding() {
  const [i, setI] = useState(0)
  const nav = useNavigate()

  const finish = () => {
    localStorage.setItem(STORAGE_KEYS.onboarding, '1')
    nav('/auth', { replace: true })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-rosera-light dark:bg-rosera-dark">
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute inset-0 flex flex-col"
          >
            <div className="relative h-[55vh] w-full shrink-0">
              <img src={slides[i].img} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-rosera-dark/80 to-transparent" />
              <span className="absolute bottom-8 start-1/2 -translate-x-1/2 text-6xl">{slides[i].emoji}</span>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center px-8 pb-8">
              <h2 className="text-center text-2xl font-bold text-rosera-text dark:text-white">{slides[i].title}</h2>
              <div className="mt-8 flex gap-2">
                {slides.map((_, j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setI(j)}
                    className={`h-2 rounded-full transition-all ${j === i ? 'w-8 bg-primary' : 'w-2 bg-rosera-gray/40'}`}
                    aria-label={`شريحة ${j + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex flex-col gap-3 border-t border-border bg-white p-6 dark:bg-card">
        {i < slides.length - 1 ? (
          <>
            <Button className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={() => setI((x) => x + 1)}>
              التالي
            </Button>
            <button type="button" className="text-center text-sm text-rosera-gray" onClick={finish}>
              تخطي
            </button>
          </>
        ) : (
          <Button className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={finish}>
            ابدأي الآن
          </Button>
        )}
      </div>
    </div>
  )
}
