import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'
import { usePreferences } from '@/contexts/PreferencesContext'
import { useI18n } from '@/hooks/useI18n'
import { useRegions } from '@/hooks/useRegions'
import PreferencesToggle from '@/components/PreferencesToggle'
import { ROSERA_LOGO_SRC } from '@/lib/branding'

const CATEGORY_CHIPS: { label: string; q: string }[] = [
  { label: 'صالون نسائي', q: 'صالون نسائي' },
  { label: 'سبا ومساج', q: 'سبا ومساج' },
  { label: 'مكياج', q: 'مكياج' },
  { label: 'عناية بالبشرة', q: 'عناية بالبشرة' },
  { label: 'عيادة تجميل', q: 'عيادة تجميل' },
  { label: 'عيادة جلدية', q: 'عيادة جلدية' },
  { label: 'عيادة ليزر', q: 'عيادة ليزر' },
  { label: 'حقن وفيلر', q: 'عيادة حقن' },
]

const REGION_CIRCLE_GRADIENTS = [
  'from-[#fce4ec] via-[#f8bbd9] to-[#ec407a]',
  'from-[#f3e5f5] via-[#e1bee7] to-[#ab47bc]',
  'from-[#fff8f9] via-[#ffccd5] to-[#f48fb1]',
  'from-[#ede7f6] via-[#d1c4e9] to-[#7e57c2]',
  'from-[#fce4ec] via-[#f48fb1] to-[#c2185b]',
  'from-[#f3e5f5] via-[#ce93d8] to-[#8e24aa]',
  'from-[#fff5f8] via-[#f8bbd0] to-[#e91e63]',
  'from-[#ede7f6] via-[#b39ddb] to-[#5e35b1]',
  'from-[#fce4ec] via-[#f06292] to-[#880e4f]',
  'from-[#f3e5f5] via-[#ba68c8] to-[#6a1b9a]',
  'from-[#fff0f5] via-[#ffb7c5] to-[#ad1457]',
  'from-[#e8eaf6] via-[#c5cae9] to-[#3949ab]',
  'from-[#fce4ec] via-[#ff80ab] to-[#c51162]',
]

export default function Home() {
  const { profile, user } = useAuth()
  const { lang } = usePreferences()
  const { t } = useI18n()
  const nav = useNavigate()
  const { regions, loading } = useRegions(lang)

  const name = profile?.full_name?.split(' ')[0] || (user ? 'جميلتي' : 'ضيفتنا')
  /** نصوص الواجهة المحلية — لا تُسمّى `t` لتعارضها مع مترجم useI18n (`tr`) */
  const ui = {
    hello: lang === 'ar' ? 'أهلاً' : 'Hello',
    title: lang === 'ar' ? `${name}` : `${name}`,
    heroSub: lang === 'ar' ? 'روزيرا — جمالكِ يبدأ هنا' : 'Rosera - Beauty starts here',
    heroTitle: lang === 'ar' ? 'إختاري منطقتكِ ثم مدينتكِ' : 'Choose your region then city',
    searchPlaceholder: lang === 'ar' ? 'ابحثي عن صالون، مدينة، منطقة، أو تصنيف...' : 'Search salon, city, region, or category...',
    categories: lang === 'ar' ? 'التصنيفات' : 'Categories',
    store: lang === 'ar' ? 'متجر الجمال' : 'Beauty Store',
    shopNow: lang === 'ar' ? 'تسوقي ←' : 'Shop now <-',
    regions: lang === 'ar' ? 'المناطق' : 'Regions',
    citiesCount: lang === 'ar' ? 'مدينة' : 'cities',
    citiesCountMany: lang === 'ar' ? 'مدن' : 'cities',
    topSalons: lang === 'ar' ? '🔥 أفضل الصالونات' : '🔥 Top salons',
    topSalonsHint:
      lang === 'ar' ? 'تقييم عالٍ وتقييمات حقيقية' : 'Top rated with real reviews',
    recommended: lang === 'ar' ? '✨ مقترحات ذكية' : '✨ Smart picks',
    recommendedHint:
      lang === 'ar' ? 'ترتيب مخصص حسب ذوقكِ' : 'Personalized ranking for you',
  }

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-30 border-b border-primary/10 bg-gradient-to-b from-white via-[#fff5fb] to-white/95 px-4 py-4 backdrop-blur-md dark:from-rosera-dark dark:via-rosera-dark">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <img src={ROSERA_LOGO_SRC} alt="" className="w-18 h-18 shrink-0 rounded-2xl object-contain" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#374151] dark:text-[#D1D5DB]">{ui.hello}</p>
              <h1 className="truncate text-xl font-extrabold text-[#1F1F1F] dark:text-foreground">{ui.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PreferencesToggle />
            <Link
              to="/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-[#9C27B0]/15 shadow-sm"
            >
              <Bell className="h-5 w-5 text-primary" />
              <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-[#E91E8C]" />
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-lg px-4 pt-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#9C27B0] via-[#E91E8C] to-[#f48fb1] px-6 py-8 text-center text-white shadow-[0_16px_48px_-12px_rgba(233,30,140,0.45)]">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
          <p className="relative text-sm font-medium text-white/95">{ui.heroSub}</p>
          <h2 className="relative mt-2 text-2xl font-extrabold leading-tight">{ui.heroTitle}</h2>
          <button
            type="button"
            onClick={() => nav('/search')}
            className="relative mt-6 flex w-full items-center gap-3 rounded-2xl bg-white/95 px-4 py-4 text-start shadow-lg"
          >
            <Search className="h-6 w-6 shrink-0 text-[#E91E8C]" />
            <span className="text-rosera-gray">{ui.searchPlaceholder}</span>
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-lg px-4 py-6">
        <h2 className="mb-4 text-lg font-extrabold text-foreground">{ui.categories}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORY_CHIPS.map(({ label, q }) => (
            <motion.button
              key={label}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => nav(`/search?categoryLabel=${encodeURIComponent(q)}`)}
              className="shrink-0 rounded-full border border-primary/20 bg-gradient-to-br from-white to-[#fce4ec]/80 px-5 py-2.5 text-sm font-semibold text-[#1F1F1F] shadow-sm dark:from-card dark:to-card dark:text-foreground"
            >
              {label}
            </motion.button>
          ))}
        </div>

        <section className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={() => nav('/top-salons')}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-l from-amber-50 via-white to-[#fff8f0] p-4 text-start shadow-sm dark:border-amber-900/40 dark:from-card dark:via-card dark:to-card"
          >
            <div className="min-w-0">
              <span className="block text-lg font-extrabold text-[#1F1F1F] dark:text-foreground">
                {ui.topSalons}
              </span>
              <span className="mt-0.5 block text-xs font-medium text-rosera-gray">{ui.topSalonsHint}</span>
            </div>
            <span className="shrink-0 text-2xl" aria-hidden>
              →
            </span>
          </button>
          <button
            type="button"
            onClick={() => nav('/recommended-salons')}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-gradient-to-l from-[#f3e5f5] via-white to-[#fce4ec]/80 p-4 text-start shadow-sm dark:from-card dark:via-card dark:to-card"
          >
            <div className="min-w-0">
              <span className="block text-lg font-extrabold text-[#1F1F1F] dark:text-foreground">
                {ui.recommended}
              </span>
              <span className="mt-0.5 block text-xs font-medium text-rosera-gray">{ui.recommendedHint}</span>
            </div>
            <span className="shrink-0 text-2xl" aria-hidden>
              →
            </span>
          </button>
        </section>

        <section className="mt-10">
          <Link
            to="/store"
            className="flex items-center justify-between rounded-2xl border border-primary/15 bg-gradient-to-l from-white to-[#fce4ec]/50 p-4 shadow-sm dark:from-card dark:to-card"
          >
            <span className="text-lg font-extrabold">{ui.store}</span>
            <span className="text-primary font-bold">{ui.shopNow}</span>
          </Link>
        </section>

        <h2 className="mb-6 mt-10 text-lg font-extrabold">{ui.regions}</h2>
        {loading ? (
          <div className="flex flex-wrap justify-center gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-36 w-36 shrink-0 rounded-full" />
            ))}
          </div>
        ) : regions.length === 0 ? (
          <p className="py-10 text-center text-sm text-rosera-gray">{t('home.regionsEmpty')}</p>
        ) : (
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-8 px-1">
            {regions.map((reg, i) => {
              const grad = REGION_CIRCLE_GRADIENTS[i % REGION_CIRCLE_GRADIENTS.length]
              const cityLabel =
                reg.totalCities === 1 ? ui.citiesCount : ui.citiesCountMany
              return (
                <motion.div
                  key={reg.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20, delay: i * 0.04 }}
                  className="flex flex-col items-center"
                >
                  <Link
                    to={`/region/${reg.id}`}
                    className="group relative flex h-[9.25rem] w-[9.25rem] sm:h-40 sm:w-40 flex-col items-center justify-center overflow-hidden rounded-full bg-gradient-to-br shadow-[0_14px_40px_-10px_rgba(194,24,91,0.35)] ring-4 ring-white/90 transition duration-300 hover:scale-[1.06] hover:shadow-[0_20px_48px_-8px_rgba(156,39,176,0.45)] dark:ring-white/10"
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br opacity-95 ${grad}`}
                      style={{ backgroundImage: `url(${reg.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-white/25 mix-blend-soft-light" />
                    <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-55 mix-blend-multiply`} />
                    <div className="relative z-[1] px-3 text-center text-white">
                      <h3 className="text-sm font-semibold leading-snug drop-shadow-md sm:text-[0.95rem] line-clamp-4">
                        {reg.name_ar}
                      </h3>
                      <p className="mt-2 text-xs font-bold tabular-nums text-white/95 drop-shadow">
                        {reg.totalCities} {cityLabel}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
