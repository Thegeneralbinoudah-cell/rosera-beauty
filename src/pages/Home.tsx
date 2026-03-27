import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { usePreferences } from '@/contexts/PreferencesContext'
import { useI18n } from '@/hooks/useI18n'
import { useRegions } from '@/hooks/useRegions'
import { RoseraLogoMark } from '@/components/branding/RoseraLogoMark'
import { DarkModeToggle } from '@/components/DarkModeToggle'
import { RosyHomeFirstIntro } from '@/components/RosyHomeFirstIntro'
import { InstallAppButton } from '@/components/InstallAppButton'
import { captureProductEvent, trackCategoryFilterSelected } from '@/lib/analytics'
import { colors } from '@/theme/colors'
import { HOME_CATEGORY_CHIPS } from '@/lib/homeCategories'
import { attachRipple } from '@/lib/ripple'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/ui/Reveal'
import { CountUp } from '@/components/ui/CountUp'

/** Region circle labels — cream on photo + strong shadow for contrast */
const REGION_CIRCLE_TEXT_STYLE: CSSProperties = {
  color: '#F5EEE8',
  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
}

function Home() {
  const { profile, user } = useAuth()
  const { lang, setLang } = usePreferences()
  const { t } = useI18n()
  const nav = useNavigate()
  const { regions, loading } = useRegions(lang)

  const [heroSearchOpen, setHeroSearchOpen] = useState(false)
  const heroSearchTriggerRef = useRef<HTMLButtonElement>(null)
  const heroSearchExpandedRef = useRef<HTMLButtonElement>(null)
  const heroSearchWasOpenRef = useRef(false)

  const closeHeroSearchPortal = useCallback(() => {
    setHeroSearchOpen(false)
  }, [])

  const [activeCategoryValue, setActiveCategoryValue] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      return sessionStorage.getItem('rosera:lastCategoryValue')
    } catch {
      return null
    }
  })

  useEffect(() => {
    const sync = () => {
      try {
        setActiveCategoryValue(sessionStorage.getItem('rosera:lastCategoryValue'))
      } catch {
        setActiveCategoryValue(null)
      }
    }
    window.addEventListener('focus', sync)
    const onVis = () => {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    captureProductEvent('home_open', {})
  }, [])

  useEffect(() => {
    if (!heroSearchOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeHeroSearchPortal()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [heroSearchOpen, closeHeroSearchPortal])

  useEffect(() => {
    if (!heroSearchOpen) return
    const id = requestAnimationFrame(() => {
      heroSearchExpandedRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [heroSearchOpen])

  useEffect(() => {
    if (heroSearchOpen) {
      heroSearchWasOpenRef.current = true
      return
    }
    if (!heroSearchWasOpenRef.current) return
    heroSearchWasOpenRef.current = false
    const id = requestAnimationFrame(() => {
      heroSearchTriggerRef.current?.focus()
    })
    return () => cancelAnimationFrame(id)
  }, [heroSearchOpen])

  useEffect(() => {
    if (!heroSearchOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [heroSearchOpen])

  const name = profile?.full_name?.split(' ')[0] || (user ? 'جميلتي' : 'ضيفتنا')
  /** نصوص الواجهة المحلية — لا تُسمّى `t` لتعارضها مع مترجم useI18n (`tr`) */
  const ui = {
    hello: lang === 'ar' ? 'أهلاً' : 'Hello',
    title: lang === 'ar' ? `${name}` : `${name}`,
    heroSub: lang === 'ar' ? 'أهلاً بكِ في عالمكِ الخاص ✨' : 'Welcome to your private world ✨',
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
    topClinics: lang === 'ar' ? 'أفضل عيادات التجميل 💉' : '💉 Top beauty clinics',
    topClinicsHint:
      lang === 'ar' ? 'تقييم عالٍ وتقييمات حقيقية' : 'Top rated with real reviews',
    recommended: lang === 'ar' ? '✨ مقترحات ذكية' : '✨ Smart picks',
    recommendedHint:
      lang === 'ar' ? 'ترتيب مخصص حسب ذوقك' : 'Personalized ranking for you',
    tagline:
      lang === 'ar'
        ? 'مساعدك الذكي لإكتشاف أفضل الصالونات والعيادات بسهولة 💖'
        : 'Your smart assistant to discover the best salons and clinics with ease 💖',
  }

  return (
    <div className="luxury-page-canvas pb-28">
      <header className="luxury-screen-header z-30">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="flex h-10 min-w-[2.5rem] shrink-0 items-center justify-center rounded-xl border border-border bg-card px-2.5 text-xs font-bold text-primary transition-colors hover:bg-muted sm:px-3"
          >
            {lang === 'ar' ? 'EN' : 'AR'}
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-3">
            <RoseraLogoMark className="h-11 w-11 shrink-0 sm:h-14 sm:w-14" aria-hidden />
            <div className="min-w-0">
              <p className="text-body-sm font-light text-muted-foreground">{ui.hello}</p>
              <h1 className="truncate font-serif text-title font-normal tracking-wide text-foreground">{ui.title}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <Link
              to="/notifications"
              aria-label={t('profile.notifications')}
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-muted"
            >
              <Bell className="h-5 w-5 text-foreground" aria-hidden />
              <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden />
            </Link>
            <DarkModeToggle />
            <Link
              to="/profile"
              aria-label={lang === 'ar' ? 'الملف الشخصي' : 'Profile'}
              className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card transition-colors hover:bg-muted"
            >
              <Avatar className="h-9 w-9 border-0">
                {profile?.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt="" className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                  {(profile?.full_name?.trim() || name || '?').charAt(0)}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-lg px-4 pt-4">
        <div className="relative overflow-hidden rounded-[20px] border border-primary/30 bg-gradient-to-br from-card via-popover to-muted px-6 py-8 text-center text-foreground shadow-[0_8px_32px_rgba(139,26,74,0.2)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(139,26,74,0.25),transparent_55%)]" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23C9963F\' fill-opacity=\'0.07\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-100" />
          <p className="relative text-sm font-light text-muted-foreground">{ui.heroSub}</p>
          <h2 className="relative mt-2 font-serif text-2xl font-normal leading-tight text-foreground">{ui.heroTitle}</h2>
          <button
            ref={heroSearchTriggerRef}
            type="button"
            id="hero-search-trigger"
            tabIndex={heroSearchOpen ? -1 : 0}
            onFocus={() => setHeroSearchOpen(true)}
            aria-label={ui.searchPlaceholder}
            aria-expanded={heroSearchOpen}
            aria-controls={heroSearchOpen ? 'hero-search-portal' : undefined}
            className={cn(
              'luxury-hero-search ripple relative mt-6',
              heroSearchOpen && 'pointer-events-none hidden'
            )}
            onClick={(e) => {
              attachRipple(e)
              setHeroSearchOpen(true)
            }}
          >
            <Search className="h-6 w-6 shrink-0 text-accent" aria-hidden />
            <span className="text-muted-foreground">{ui.searchPlaceholder}</span>
          </button>
          {heroSearchOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                id="hero-search-portal"
                role="dialog"
                aria-modal="true"
                aria-label={ui.searchPlaceholder}
                className="fixed inset-0 z-[10045]"
                data-hero-search-portal
              >
                <div
                  role="presentation"
                  aria-hidden
                  className="fixed inset-0 bg-background/70 backdrop-blur-[8px] transition-opacity duration-300 motion-reduce:backdrop-blur-none"
                  onClick={closeHeroSearchPortal}
                />
                <div className="pointer-events-none relative z-[10050] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] transition-all duration-300">
                  <button
                    ref={heroSearchExpandedRef}
                    type="button"
                    data-hero-search-expanded="true"
                    className="luxury-hero-search ripple pointer-events-auto relative mx-auto w-full max-w-lg shadow-lg"
                    onClick={(e) => {
                      attachRipple(e)
                      closeHeroSearchPortal()
                      nav('/search')
                    }}
                  >
                    <Search className="h-6 w-6 shrink-0 text-accent" aria-hidden />
                    <span className="text-muted-foreground">{ui.searchPlaceholder}</span>
                  </button>
                </div>
              </div>,
              document.body
            )}
        </div>
      </section>

      <Reveal className="mx-auto max-w-lg space-y-6 px-4 py-4">
        <div className="space-y-2">
          <h2 className="luxury-section-heading mb-2">{t('search.sortLabel')}</h2>
          <div
            className="flex min-h-12 flex-nowrap gap-2 overflow-x-auto pb-2 scrollbar-hide"
            role="group"
            aria-label={t('a11y.sortResults')}
          >
            {(
              [
                { sort: 'nearest' as const, label: t('search.sortNearest') },
                { sort: 'booked' as const, label: t('city.sort.booked') },
                { sort: 'rating' as const, label: t('city.sort.rating') },
              ] as const
            ).map(({ sort, label }) => (
              <Link
                key={sort}
                to={`/search?sort=${sort}`}
                className="category-chip inline-flex items-center justify-center gap-2 whitespace-nowrap"
                onClick={(e) => attachRipple(e)}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="luxury-section-heading mt-4 mb-2">{ui.categories}</h2>
          <div className="flex min-h-12 flex-nowrap gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {HOME_CATEGORY_CHIPS.map(({ id, label, icon, categoryValue }) => {
            const active = activeCategoryValue === categoryValue
            return (
              <motion.button
                key={id}
                type="button"
                whileTap={{ scale: 0.94 }}
                transition={{ type: 'spring', stiffness: 460, damping: 16 }}
                onClick={(e) => {
                  attachRipple(e)
                  try {
                    sessionStorage.setItem('rosera:lastCategoryValue', categoryValue)
                  } catch {
                    /* ignore */
                  }
                  setActiveCategoryValue(categoryValue)
                  trackCategoryFilterSelected('home_chip', categoryValue)
                  nav(`/search?categoryValue=${encodeURIComponent(categoryValue)}`)
                }}
                className={cn(
                  'category-chip flex min-w-fit items-center justify-center gap-2 whitespace-nowrap',
                  active && 'category-chip--selected'
                )}
              >
                <span aria-hidden>{icon}</span>
                {label}
              </motion.button>
            )
          })}
          </div>
        </div>

        <section className="motion-stagger mt-4 mb-2 grid gap-3">
          <button
            type="button"
            onClick={(e) => {
              attachRipple(e)
              nav('/top-salons')
            }}
            className="ripple relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[20px] border border-primary/20 bg-gradient-to-l from-muted via-card to-popover p-5 text-start shadow-[0_8px_32px_rgba(139,26,74,0.18)] transition-all hover:shadow-[0_12px_40px_rgba(139,26,74,0.25)]"
            style={{
              backgroundImage: `linear-gradient(to left, color-mix(in srgb, ${colors.surface} 92%, transparent), ${colors.surface}, ${colors.secondary})`,
            }}
          >
            <div className="min-w-0">
              <span className="block font-serif text-lg font-normal text-foreground">
                {ui.topSalons}
              </span>
              <span className="mt-0.5 block text-xs font-light text-muted-foreground">{ui.topSalonsHint}</span>
            </div>
            <span className="shrink-0 text-2xl" aria-hidden>
              →
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              attachRipple(e)
              nav('/top-clinics')
            }}
            className="ripple relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[20px] border border-primary/25 bg-gradient-to-l from-card via-popover to-muted p-5 text-start shadow-[0_8px_32px_rgba(139,26,74,0.18)] transition-all hover:shadow-[0_12px_40px_rgba(139,26,74,0.25)]"
            style={{
              backgroundImage: `linear-gradient(to left, color-mix(in srgb, ${colors.primary} 18%, ${colors.surface}), ${colors.surface}, ${colors.secondary})`,
            }}
          >
            <div className="min-w-0">
              <span className="block font-serif text-lg font-normal text-foreground">
                {ui.topClinics}
              </span>
              <span className="mt-0.5 block text-xs font-light text-muted-foreground">{ui.topClinicsHint}</span>
            </div>
            <span className="shrink-0 text-2xl" aria-hidden>
              →
            </span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              attachRipple(e)
              nav('/recommended-salons')
            }}
            className="ripple relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-[20px] border border-accent/25 bg-gradient-to-l from-muted via-card to-popover p-5 text-start shadow-[0_8px_32px_rgba(139,26,74,0.18)] transition-all hover:shadow-[0_12px_40px_rgba(139,26,74,0.25)]"
          >
            <div className="min-w-0">
              <span className="block font-serif text-lg font-normal text-foreground">
                {ui.recommended}
              </span>
              <span className="mt-0.5 block text-xs font-light text-muted-foreground">{ui.recommendedHint}</span>
            </div>
            <span className="shrink-0 text-2xl" aria-hidden>
              →
            </span>
          </button>
        </section>

        <section className="mt-4 mb-2">
          <Link
            to="/store"
            className="ripple relative flex items-center justify-between overflow-hidden rounded-[20px] border border-primary/20 bg-gradient-to-l from-card p-5 shadow-[0_8px_32px_rgba(139,26,74,0.18)] transition-all hover:shadow-[0_12px_40px_rgba(139,26,74,0.25)]"
            onClick={(e) => attachRipple(e)}
            style={{
              backgroundImage: `linear-gradient(to left, ${colors.surface}, color-mix(in srgb, ${colors.primary} 45%, ${colors.surface}))`,
            }}
          >
            <span className="font-serif text-lg font-normal text-foreground">{ui.store}</span>
            <span className="font-normal text-accent">{ui.shopNow}</span>
          </Link>
        </section>

        <h2 className="luxury-section-heading mt-4 mb-2">{ui.regions}</h2>
        {loading ? (
          <div className="flex flex-wrap justify-center gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-36 w-36 shrink-0 rounded-full" />
            ))}
          </div>
        ) : regions.length === 0 ? (
          <p className="py-10 text-center text-sm text-rosera-gray">{t('home.regionsEmpty')}</p>
        ) : (
          <div className="motion-stagger flex flex-wrap justify-center gap-x-5 gap-y-8 px-1">
            {regions.map((reg) => {
              const cityLabel =
                reg.totalCities === 1 ? ui.citiesCount : ui.citiesCountMany
              return (
                <div key={reg.id} className="flex flex-col items-center">
                  <Link
                    to={`/region/${reg.id}`}
                    className="group relative flex h-[9.25rem] w-[9.25rem] sm:h-40 sm:w-40 flex-col items-center justify-center overflow-hidden rounded-full border-2 border-[#C9963F] shadow-[0_0_12px_rgba(201,150,63,0.4)] transition duration-300 hover:scale-[1.06] hover:shadow-[0_0_16px_rgba(201,150,63,0.55)]"
                  >
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `url(${reg.image_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div
                      className="pointer-events-none absolute inset-0 z-[1]"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(139, 26, 74, 0.75) 0%, transparent 60%)',
                      }}
                      aria-hidden
                    />
                    <div className="relative z-[2] px-3 text-center">
                      <h3
                        className="line-clamp-4 font-serif text-base font-normal leading-snug"
                        style={REGION_CIRCLE_TEXT_STYLE}
                      >
                        {reg.name_ar}
                      </h3>
                      <p
                        className="mt-2 font-light tabular-nums"
                        style={{ ...REGION_CIRCLE_TEXT_STYLE, fontSize: 12 }}
                      >
                        <CountUp value={reg.totalCities} className="tabular-nums" decimals={0} /> {cityLabel}
                      </p>
                    </div>
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </Reveal>

      <Reveal>
      <section className="mx-auto max-w-lg px-4 pt-8" aria-label={lang === 'ar' ? 'عن التطبيق' : 'About the app'}>
        <div className="relative overflow-hidden rounded-[20px] border border-primary/20 bg-gradient-to-br from-card via-popover to-muted px-5 py-4 shadow-[0_8px_32px_rgba(139,26,74,0.18)]">
          <div
            className="pointer-events-none absolute -end-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-primary/25 to-accent/20 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-8 -start-8 h-24 w-24 rounded-full bg-gradient-to-tr from-accent/15 to-primary/15 blur-2xl"
            aria-hidden
          />
          <p className="relative text-center font-serif text-base font-normal leading-relaxed tracking-wide text-foreground">
            {ui.tagline}
          </p>
        </div>
      </section>
      </Reveal>

      <div className="mx-auto max-w-lg space-y-3 px-4 pb-4 pt-4">
        <RosyHomeFirstIntro />
        <div className="flex justify-center">
          <InstallAppButton
            variant="premium"
            labelKey="pwa.installCtaStrong"
            className="h-12 min-h-[3rem] w-full max-w-md px-6 text-base"
          />
        </div>
      </div>
    </div>
  )
}

export default memo(Home)
