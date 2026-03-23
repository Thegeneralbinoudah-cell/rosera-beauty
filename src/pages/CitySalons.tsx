import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { BusinessCard } from '@/components/business/BusinessCard'
import { CityComingSoonEmpty } from '@/components/empty-states/CityComingSoonEmpty'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { SortPills } from '@/components/ui/sort-pills'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { useCitySalons } from '@/hooks/useCitySalons'
import { fetchActiveBusinessBoostMeta, type BoostMeta } from '@/lib/boosts'
import {
  fetchActiveSalonFeaturedAdSalonIds,
  partitionSalonsWithFeaturedAdsFirst,
} from '@/lib/salonAds'
import { haversineKm } from '@/lib/utils'

const CITY_SORT_PREFS_KEY = 'rosera:city:sort'

export default function CitySalons() {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const { cityId } = useParams()
  const [params, setParams] = useSearchParams()
  const storedSort = (() => {
    const x = localStorage.getItem(CITY_SORT_PREFS_KEY)
    return x === 'booked' || x === 'nearest' ? x : 'rating'
  })()
  const { cityName, regionId, salons, loading } = useCitySalons(cityId, lang)
  const [salonBoostMeta, setSalonBoostMeta] = useState<Map<string, BoostMeta>>(new Map())
  const [featuredAdIds, setFeaturedAdIds] = useState<Set<string>>(new Set())
  const urlSort = params.get('sort')
  const [sortBy, setSortBy] = useState<'rating' | 'booked' | 'nearest'>(() =>
    urlSort === 'booked' || urlSort === 'nearest' ? urlSort : storedSort
  )
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const activeFiltersCount = sortBy !== 'rating' ? 1 : 0

  const resetCityFilters = () => {
    setSortBy('rating')
    localStorage.removeItem(CITY_SORT_PREFS_KEY)
    setParams(new URLSearchParams(), { replace: true })
    toast.success(t('city.resetToast'))
  }

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    )
  }, [])

  useEffect(() => {
    if (sortBy !== 'nearest') return
    if (userPos) return
    navigator.geolocation?.getCurrentPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 }
    )
  }, [sortBy, userPos])

  useEffect(() => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('sort', sortBy)
        return p
      },
      { replace: true }
    )
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

  useEffect(() => {
    if (!salons.length) {
      setFeaturedAdIds(new Set())
      return
    }
    let c = true
    void fetchActiveSalonFeaturedAdSalonIds(salons.map((s) => s.id)).then((s) => {
      if (c) setFeaturedAdIds(s)
    })
    return () => {
      c = false
    }
  }, [salons])

  const displaySalons = useMemo(() => {
    const sorted = [...salons].sort((a, b) => {
      if (sortBy === 'booked') {
        return (
          Number(b.total_bookings ?? 0) - Number(a.total_bookings ?? 0) ||
          Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0)
        )
      }
      if (sortBy === 'nearest' && userPos) {
        const da =
          a.latitude != null && a.longitude != null
            ? haversineKm(userPos.lat, userPos.lng, a.latitude, a.longitude)
            : 99999
        const db =
          b.latitude != null && b.longitude != null
            ? haversineKm(userPos.lat, userPos.lng, b.latitude, b.longitude)
            : 99999
        return da - db
      }
      return (
        Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0) ||
        Number(b.total_reviews ?? 0) - Number(a.total_reviews ?? 0)
      )
    })
    return partitionSalonsWithFeaturedAdsFirst(sorted, featuredAdIds)
  }, [salons, sortBy, userPos, featuredAdIds])

  return (
    <div className="min-h-dvh bg-white pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-20 border-b border-[#F9A8C9]/25 bg-white px-4 py-4 shadow-sm dark:border-border dark:bg-card">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {regionId && (
            <Link
              to={`/region/${regionId}`}
              className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-[#BE185D] transition-colors hover:text-[#9D174D] dark:text-primary"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              {t('city.backRegion')}
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-[#374151] dark:text-foreground">{cityName || '...'}</h1>
            <p className="text-sm font-medium text-[#6B7280] dark:text-muted-foreground">{t('city.subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {!loading && salons.length > 0 && (
          <div className="mb-4 space-y-3">
            <SortPills
              value={sortBy}
              onChange={(v) => setSortBy(v)}
              options={[
                { value: 'rating', label: t('city.sort.rating') },
                { value: 'booked', label: t('city.sort.booked') },
                { value: 'nearest', label: t('search.sortNearest') },
              ]}
            />
            <Button variant="ghost" size="sm" className="gap-1" onClick={resetCityFilters}>
              {t('common.reset')}
              {activeFiltersCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F9A8C9] px-1 text-[10px] font-extrabold text-[#374151]">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>
        )}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        ) : salons.length === 0 ? (
          <CityComingSoonEmpty ctaTo={regionId ? `/region/${regionId}` : '/home'} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {displaySalons.map((b) => {
              const meta = salonBoostMeta.get(b.id)
              return (
                <BusinessCard
                  key={b.id}
                  b={b}
                  showFavorite
                  isSponsored={!!meta}
                  sponsorLabel={meta?.boost_type}
                  isFeaturedAd={featuredAdIds.has(b.id)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
