import { useEffect, useRef, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { usePreferences } from '@/contexts/PreferencesContext'
import { useAuth } from '@/contexts/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { SalonPremiumCard } from '@/components/salon/SalonPremiumCard'
import { rankSalons, fetchAiUserProfile, type RankableSalon, type RankedSalon } from '@/lib/aiRanking'
import { fetchBestActiveOffersByBusinessIds } from '@/lib/offers'

type TopSalonRow = RankableSalon & {
  name_ar: string
  cover_image: string | null
}

function TopSalonCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-primary/10 shadow-lg">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-[85%]" />
        <Skeleton className="h-4 w-[40%] max-w-[10rem]" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-11 w-full rounded-xl" />
      </div>
    </Card>
  )
}

function orderRecommendedFirst(list: RankedSalon<TopSalonRow>[]): RankedSalon<TopSalonRow>[] {
  const rec = list.filter((r) => r.isRecommended)
  const rest = list.filter((r) => !r.isRecommended)
  return [...rec, ...rest]
}

export default function TopSalons() {
  const { lang } = usePreferences()
  const { user } = useAuth()
  const [rows, setRows] = useState<RankedSalon<TopSalonRow>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const firstRecRef = useRef<HTMLDivElement | null>(null)

  const ui = {
    title: lang === 'ar' ? 'أفضل الصالونات' : 'Top salons',
    subtitle:
      lang === 'ar'
        ? 'تقييم عالٍ وتقييمات موثوقة — مرتبة بذكاء'
        : 'High ratings and trusted reviews — smart ranked',
    empty: lang === 'ar' ? 'لا توجد توصيات حالياً' : 'No recommendations right now.',
    reviews: lang === 'ar' ? 'تقييم' : 'reviews',
    badgeTop: '🔥 الأفضل',
    badgeRec: '⭐ موصى به',
    book: lang === 'ar' ? 'احجزي الآن' : 'Book now',
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setError(lang === 'ar' ? 'اضبطي اتصال Supabase في الإعدادات.' : 'Configure Supabase in settings.')
          setRows([])
          setLoading(false)
        }
        return
      }
      if (!cancelled) {
        setLoading(true)
        setError(null)
      }

      const { data, error: qErr } = await supabase
        .from('businesses')
        .select('id,name_ar,cover_image,average_rating,total_reviews,category,category_label')
        .gte('average_rating', 4.0)
        .gt('total_reviews', 20)
        .limit(48)

      if (cancelled) return
      if (qErr) {
        setError(lang === 'ar' ? 'تعذر تحميل القائمة.' : 'Could not load the list.')
        setRows([])
        setLoading(false)
        return
      }

      const raw = (data ?? []) as TopSalonRow[]
      const offerMap = await fetchBestActiveOffersByBusinessIds(raw.map((r) => r.id))
      const withOffers = raw.map((r) => ({ ...r, activeOffer: offerMap.get(r.id) ?? null }))
      let profile = undefined
      if (user?.id) {
        profile = await fetchAiUserProfile(user.id)
      }

      if (cancelled) return
      const ranked = rankSalons(withOffers, profile)
      const display = orderRecommendedFirst(ranked).slice(0, 10)
      setRows(display)
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [lang, user?.id])

  const firstRecId = rows.find((r) => r.isRecommended)?.id

  useEffect(() => {
    if (loading || error || rows.length === 0) return
    if (!rows.some((r) => r.isRecommended)) return
    const id = window.setTimeout(() => {
      firstRecRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 400)
    return () => clearTimeout(id)
  }, [loading, error, rows])

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#fff5fb] via-white to-[#fce4ec]/30 pb-28 dark:from-rosera-dark dark:via-rosera-dark dark:to-rosera-dark">
      <header className="sticky top-0 z-20 border-b border-primary/10 bg-white/80 px-4 py-5 backdrop-blur-xl dark:bg-rosera-dark/90">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1F1F1F] dark:text-foreground">{ui.title}</h1>
          <p className="mt-1.5 text-sm font-medium text-[#6B7280] dark:text-rosera-gray">{ui.subtitle}</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <TopSalonCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-destructive/20 bg-destructive/5 py-16 text-center text-sm font-medium text-destructive">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-primary/25 bg-white/60 py-20 text-center dark:bg-card/40">
            <p className="text-sm font-medium text-rosera-gray">{ui.empty}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {rows.map((row) => (
              <div
                key={row.id}
                ref={row.id === firstRecId ? firstRecRef : undefined}
                className={row.isRecommended ? 'scroll-mt-28 sm:scroll-mt-32' : undefined}
              >
                <SalonPremiumCard
                  salon={row}
                  activeOffer={row.activeOffer ?? null}
                  reviewsLabel={ui.reviews}
                  badgeTop={ui.badgeTop}
                  badgeRec={ui.badgeRec}
                  bookLabel={ui.book}
                  showCity={false}
                  isRecommended={row.isRecommended}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
