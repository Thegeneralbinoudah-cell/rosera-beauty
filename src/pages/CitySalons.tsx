import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { BusinessCard } from '@/components/business/BusinessCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { useCitySalons } from '@/hooks/useCitySalons'
import { fetchActiveBusinessBoostMeta, type BoostMeta } from '@/lib/boosts'

const CITY_SORT_PREFS_KEY = 'rosera:city:sort'

export default function CitySalons() {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const { cityId } = useParams()
  const [params, setParams] = useSearchParams()
  const storedSort = (() => {
    const x = localStorage.getItem(CITY_SORT_PREFS_KEY)
    return x === 'booked' ? 'booked' : 'rating'
  })()
  const { cityName, regionId, salons, loading } = useCitySalons(cityId, lang)
  const [salonBoostMeta, setSalonBoostMeta] = useState<Map<string, BoostMeta>>(new Map())
  const [sortBy, setSortBy] = useState<'rating' | 'booked'>(() =>
    params.get('sort') === 'booked' ? 'booked' : storedSort
  )
  const activeFiltersCount = sortBy !== 'rating' ? 1 : 0

  const resetCityFilters = () => {
    setSortBy('rating')
    localStorage.removeItem(CITY_SORT_PREFS_KEY)
    setParams(new URLSearchParams(), { replace: true })
    toast.success(t('city.resetToast'))
  }

  useEffect(() => {
    const p = new URLSearchParams()
    p.set('sort', sortBy)
    setParams(p, { replace: true })
    localStorage.setItem(CITY_SORT_PREFS_KEY, sortBy)
  }, [sortBy, setParams])

  useEffect(() => {
    if (!salons.length) {
      setSalonBoostMeta(new Map())
      return
    }
    let c = true
    void fetchActiveBusinessBoostMeta(salons.map((s) => s.id)).then((m) => {
      if (c) setSalonBoostMeta(m)
    })
    return () => {
      c = false
    }
  }, [salons])

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-20 border-b border-primary/10 bg-gradient-to-b from-[#fce4ec]/90 to-white px-4 py-4 backdrop-blur dark:from-rosera-dark dark:to-rosera-dark">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {regionId && (
            <Link
              to={`/region/${regionId}`}
              className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-[#9B2257] dark:text-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {t('city.backRegion')}
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-[#1F1F1F] dark:text-foreground">{cityName || '...'}</h1>
            <p className="text-sm font-medium text-[#374151] dark:text-rosera-gray">{t('city.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {!loading && salons.length > 0 && (
          <div className="mb-4 flex items-center gap-2">
            <Select value={sortBy} onValueChange={(v: 'rating' | 'booked') => setSortBy(v)}>
              <SelectTrigger className="h-10 rounded-xl bg-white dark:bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">{t('city.sort.rating')}</SelectItem>
                <SelectItem value="booked">{t('city.sort.booked')}</SelectItem>
              </SelectContent>
            </Select>
            <button
              type="button"
              className="inline-flex h-10 items-center gap-1 rounded-xl border border-primary/20 px-3 text-xs font-bold text-primary"
              onClick={resetCityFilters}
            >
              {t('common.reset')}
              {activeFiltersCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-white">
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        )}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        ) : salons.length === 0 ? (
          <p className="py-16 text-center text-rosera-gray">{t('city.empty')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {[...salons]
              .sort((a, b) => {
                if (sortBy === 'booked') {
                  return (
                    Number(b.total_bookings ?? 0) - Number(a.total_bookings ?? 0) ||
                    Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0)
                  )
                }
                return (
                  Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0) ||
                  Number(b.total_reviews ?? 0) - Number(a.total_reviews ?? 0)
                )
              })
              .map((b) => {
                const meta = salonBoostMeta.get(b.id)
                return (
              <BusinessCard
                key={b.id}
                b={b}
                showFavorite
                isSponsored={!!meta}
                sponsorLabel={meta?.boost_type}
              />
                )
              })}
          </div>
        )}
      </div>
    </div>
  )
}
