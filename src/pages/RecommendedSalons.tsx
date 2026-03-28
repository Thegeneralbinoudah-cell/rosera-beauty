import { useEffect, useState } from 'react'
import { usePreferences } from '@/contexts/PreferencesContext'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { SalonPremiumCard } from '@/components/salon/SalonPremiumCard'
import { getRecommendedSalons, type SalonWithRecommendMeta } from '@/lib/aiRanking'

function CardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-2xl border-border shadow-lg">
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
  const [rows, setRows] = useState<SalonWithRecommendMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ui = {
    title: lang === 'ar' ? '✨ مقترحات ذكية' : '✨ Smart picks',
    subtitle:
      lang === 'ar' ? 'ترتيب مخصص حسب ذوقك' : 'Personalized ranking for you',
    empty: lang === 'ar' ? 'لا توجد توصيات حالياً' : 'No recommendations right now.',
    reviews: lang === 'ar' ? 'تقييم' : 'reviews',
    badgeTop: '🔥 الأفضل',
    badgeRec: '⭐ موصى به',
    book: lang === 'ar' ? 'احجزي الآن' : 'Book now',
  }

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const data = await getRecommendedSalons(null, {
          limit: 6,
          poolLimit: 400,
          sort: 'rating',
        })
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
  }, [lang])

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-background to-muted/30 pb-28">
      <header className="sticky top-0 z-20 border-b border-border bg-card px-4 py-5 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{ui.title}</h1>
          <p className="mt-1.5 text-sm font-medium text-foreground">{ui.subtitle}</p>
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
          <div className="rounded-2xl border border-dashed border-border bg-muted py-20 text-center">
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
                scoreCaption={
                  lang === 'ar'
                    ? `التقييم ${(row.average_rating ?? 0).toFixed(1)}`
                    : `Rating ${(row.average_rating ?? 0).toFixed(1)}`
                }
                isRecommended={row.isRecommended ?? false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
