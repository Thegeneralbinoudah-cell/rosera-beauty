import { useEffect, useState } from 'react'
import { usePreferences } from '@/contexts/PreferencesContext'
import { useAuth } from '@/contexts/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { SalonPremiumCard } from '@/components/salon/SalonPremiumCard'
import { getRecommendedSalons, type RecommendedSalon } from '@/lib/aiRanking'

function CardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-primary/10 shadow-lg">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-5 w-[85%]" />
        <Skeleton className="h-4 w-[45%]" />
        <Skeleton className="h-6 w-28 rounded-full" />
        <Skeleton className="mt-2 h-11 w-full rounded-xl" />
      </div>
    </Card>
  )
}

export default function RecommendedSalons() {
  const { lang } = usePreferences()
  const { user } = useAuth()
  const [rows, setRows] = useState<RecommendedSalon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ui = {
    title: lang === 'ar' ? 'مقترحات ذكية' : 'Smart picks',
    subtitle:
      lang === 'ar'
        ? user
          ? 'ترتيب حسب ذوقكِ، حجوزاتكِ، ومفضلتكِ'
          : 'ترتيب ذكي حسب الجودة والتقييمات — سجّلي دخولكِ لتخصيص أدق'
        : user
          ? 'Ranked from your taste, bookings, and favorites'
          : 'Quality-aware ranking — sign in to personalize',
    empty: lang === 'ar' ? 'لا توجد توصيات حالياً' : 'No recommendations right now.',
    reviews: lang === 'ar' ? 'تقييم' : 'reviews',
    badgeTop: '🔥 الأفضل',
    badgeRec: '⭐ موصى به',
    book: lang === 'ar' ? 'احجزي الآن' : 'Book now',
    score: lang === 'ar' ? 'درجة التوصية' : 'Match score',
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const data = await getRecommendedSalons(user?.id ?? null, { limit: 12, poolLimit: 240 })
        if (!cancelled) setRows(data)
      } catch {
        if (!cancelled) {
          setError(lang === 'ar' ? 'تعذر تحميل المقترحات.' : 'Could not load recommendations.')
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [user?.id, lang])

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#faf5ff] via-white to-[#fce4ec]/25 pb-28 dark:from-rosera-dark dark:via-rosera-dark dark:to-rosera-dark">
      <header className="sticky top-0 z-20 border-b border-primary/10 bg-white/85 px-4 py-5 backdrop-blur-xl dark:bg-rosera-dark/90">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#1F1F1F] dark:text-foreground">{ui.title}</h1>
          <p className="mt-1.5 text-sm font-medium text-[#6B7280] dark:text-rosera-gray">{ui.subtitle}</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <SalonPremiumCard
                key={row.id}
                salon={row}
                activeOffer={row.activeOffer ?? null}
                reviewsLabel={ui.reviews}
                badgeTop={ui.badgeTop}
                badgeRec={ui.badgeRec}
                bookLabel={ui.book}
                showCity
                scoreCaption={`${ui.score} ${row.score.toFixed(2)}`}
                isRecommended={row.isRecommended}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
