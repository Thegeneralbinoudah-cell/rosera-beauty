import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { STORAGE_KEYS } from '@/lib/utils'
import { usePreferences } from '@/contexts/PreferencesContext'
import PreferencesToggle from '@/components/PreferencesToggle'
import { ROSERA_LOGO_SRC } from '@/lib/branding'

const slides = [
  {
    titleAr: 'اكتشفي أفضل الصالونات',
    titleEn: 'Discover top salons',
    img: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
  },
  {
    titleAr: 'احجزي موعدك بسهولة',
    titleEn: 'Book appointments easily',
    img: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
  },
  {
    titleAr: 'روزي الذكية — مساعدتك الشخصية',
    titleEn: 'Rozi — your personal assistant',
    img: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800',
  },
  {
    titleAr: 'متجر الجمال — منتجات أصيلة',
    titleEn: 'Beauty store — authentic products',
    img: 'https://images.unsplash.com/photo-1596462502278-27bfdc403543?w=800',
  },
  {
    titleAr: 'جمالكِ يبدأ مع روزيرا',
    titleEn: 'Your beauty journey starts here',
    img: 'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800',
  },
] as const

export default function Onboarding() {
  const [i, setI] = useState(0)
  const { lang } = usePreferences()
  const nav = useNavigate()
  const t = {
    next: lang === 'ar' ? 'التالي' : 'Next',
    skip: lang === 'ar' ? 'تخطي' : 'Skip',
    start: lang === 'ar' ? 'ابدئي الآن' : 'Start now',
  }

  const finish = () => {
    localStorage.setItem(STORAGE_KEYS.onboarding, '1')
    nav('/auth', { replace: true })
  }

  const title = lang === 'ar' ? slides[i].titleAr : slides[i].titleEn

  return (
    <div className="flex min-h-dvh flex-col bg-rosera-light dark:bg-rosera-dark">
      <div className="absolute end-4 top-4 z-40">
        <PreferencesToggle />
      </div>
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
              <div className="absolute bottom-8 start-1/2 flex -translate-x-1/2 justify-center">
                <img src={ROSERA_LOGO_SRC} alt="" className="rosera-flower-logo logo-lg" />
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center px-8 pb-8">
              <h2 className="text-center text-2xl font-bold text-foreground dark:text-white">{title}</h2>
              <div className="mt-8 flex gap-2">
                {slides.map((_, j) => (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setI(j)}
                    className={`h-2 rounded-full transition-all ${j === i ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/40'}`}
                    aria-label={`شريحة ${j + 1}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex flex-col gap-3 border-t border-border bg-card p-6 dark:bg-card">
        {i < slides.length - 1 ? (
          <>
            <Button className="w-full rounded-2xl gradient-primary" onClick={() => setI((x) => x + 1)}>
              {t.next}
            </Button>
            <button type="button" className="text-center text-sm font-medium text-foreground dark:text-foreground" onClick={finish}>
              {t.skip}
            </button>
          </>
        ) : (
          <Button className="w-full rounded-2xl gradient-primary" onClick={finish}>
            {t.start}
          </Button>
        )}
      </div>
    </div>
  )
}
