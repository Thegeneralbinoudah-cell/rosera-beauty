import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { Search as SearchIcon, SlidersHorizontal, MapPin } from 'lucide-react'
import { supabase, type Business } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BusinessCard } from '@/components/business/BusinessCard'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SortPills } from '@/components/ui/sort-pills'
import { EmptyState } from '@/components/ui/empty-state'
import { haversineKm } from '@/lib/utils'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { filterFemaleBeautyBusinesses } from '@/lib/roseraBusinessFilters'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'
import { markGeolocationKnown } from '@/lib/geoSession'
import { fetchActiveSalonFeaturedAdSalonIds } from '@/lib/salonAds'
import {
  SEARCH_BUSINESS_CATEGORY_OPTIONS,
  resolveSearchCategoryFilter,
  businessMatchesSearchCategory,
  normalizeArabicLabel,
} from '@/lib/searchCategoryFilter'
import { trackCategoryFilterSelected } from '@/lib/analytics'

type BizRow = Business & {
  sa_cities?: { name_ar: string; sa_regions?: { name_ar: string } | null } | null
}

const SEARCH_SORT_PREFS_KEY = 'rosera:search:sort'

export default function SearchPage() {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [list, setList] = useState<BizRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [cityF, setCityF] = useState(params.get('city') || '')
  const categoryLabelF = params.get('categoryLabel') || ''
  const [catLabelLocal, setCatLabelLocal] = useState(categoryLabelF)
  const [minRating, setMinRating] = useState('0')
  const [sortBy, setSortBy] = useState<'rating' | 'booked' | 'nearest'>(() => {
    const fromUrl = params.get('sort')
    if (fromUrl === 'rating' || fromUrl === 'booked' || fromUrl === 'nearest') return fromUrl
    const fromLs = localStorage.getItem(SEARCH_SORT_PREFS_KEY)
    return fromLs === 'booked' || fromLs === 'nearest' ? fromLs : 'rating'
  })
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const [featuredAdIds, setFeaturedAdIds] = useState<Set<string>>(new Set())

  const resetSearchFilters = () => {
    setQ('')
    setCityF('')
    setCatLabelLocal('')
    setMinRating('0')
    setSortBy('rating')
    setParams(new URLSearchParams(), { replace: true })
    localStorage.removeItem(SEARCH_SORT_PREFS_KEY)
    toast.success(t('search.resetToast'))
  }

  useEffect(() => {
    setCatLabelLocal(categoryLabelF)
  }, [categoryLabelF])

  /** Normalize legacy/alias `categoryLabel` in the URL to the canonical chip string. */
  useEffect(() => {
    const res = resolveSearchCategoryFilter(categoryLabelF)
    if (!res.ok) return
    if (normalizeArabicLabel(categoryLabelF) === res.canonical) return
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('categoryLabel', res.canonical)
        return p
      },
      { replace: true }
    )
  }, [categoryLabelF, setParams])

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        markGeolocationKnown()
        setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude })
      },
      () => {}
    )
  }, [])

  useEffect(() => {
    if (sortBy !== 'nearest') return
    if (userPos) return
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        markGeolocationKnown()
        setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude })
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 }
    )
  }, [sortBy, userPos])

  useEffect(() => {
    localStorage.setItem(SEARCH_SORT_PREFS_KEY, sortBy)
  }, [sortBy])

  useEffect(() => {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        p.set('sort', sortBy)
        return p
      },
      { replace: true }
    )
  }, [sortBy, setParams])

  useEffect(() => {
    let c = true
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select(
            `
            *,
            sa_cities ( name_ar, sa_regions ( name_ar ) )
          `
          )
          .eq('is_active', true)
          .eq('is_demo', false)
        if (error) throw error
        if (!c) return
        setList(filterFemaleBeautyBusinesses((data ?? []) as Business[]) as BizRow[])
      } catch {
        if (c) toast.error(t('search.error'))
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [])

  const filtered = useMemo(() => {
    let r = list
    const qq = q.trim()
    if (qq) {
      r = r.filter((b) => {
        const regName = b.sa_cities?.sa_regions?.name_ar ?? b.region ?? ''
        const cityN = b.sa_cities?.name_ar ?? b.city
        const hay = `${b.name_ar} ${cityN} ${regName} ${b.category_label ?? ''} ${b.description_ar ?? ''}`
        return hay.includes(qq)
      })
    }
    if (cityF.trim()) {
      r = r.filter((b) => (b.city === cityF || b.sa_cities?.name_ar === cityF))
    }
    const catRes = resolveSearchCategoryFilter(catLabelLocal)
    if (catRes.ok) {
      r = r.filter((b) => businessMatchesSearchCategory(b, catRes.canonical))
    }
    const mr = parseFloat(minRating)
    if (mr > 0) r = r.filter((b) => (b.average_rating ?? 0) >= mr)

    if (sortBy === 'rating') {
      r = [...r].sort(
        (a, b) =>
          Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0) ||
          Number(b.total_reviews ?? 0) - Number(a.total_reviews ?? 0)
      )
    } else if (sortBy === 'booked') {
      r = [...r].sort(
        (a, b) =>
          Number(b.total_bookings ?? 0) - Number(a.total_bookings ?? 0) ||
          Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0)
      )
    } else if (sortBy === 'nearest') {
      if (userPos) {
        r = [...r].sort((a, b) => {
          if (!a.latitude || !a.longitude) return 1
          if (!b.latitude || !b.longitude) return -1
          return (
            haversineKm(userPos.lat, userPos.lng, a.latitude, a.longitude) -
            haversineKm(userPos.lat, userPos.lng, b.latitude, b.longitude)
          )
        })
      } else {
        r = [...r].sort(
          (a, b) =>
            Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0) ||
            Number(b.total_reviews ?? 0) - Number(a.total_reviews ?? 0)
        )
      }
    }
    return r
  }, [list, q, cityF, catLabelLocal, minRating, sortBy, userPos])

  const categoryBannerLabel = (() => {
    const res = resolveSearchCategoryFilter(catLabelLocal)
    return res.ok ? res.canonical : null
  })()

  const withDist = useMemo(() => {
    if (!userPos) return filtered.map((b) => ({ b, km: undefined as number | undefined }))
    return filtered.map((b) => ({
      b,
      km:
        b.latitude && b.longitude
          ? haversineKm(userPos.lat, userPos.lng, b.latitude, b.longitude)
          : undefined,
    }))
  }, [filtered, userPos])

  useEffect(() => {
    if (!filtered.length) {
      setFeaturedAdIds(new Set())
      return
    }
    let c = true
    void fetchActiveSalonFeaturedAdSalonIds(filtered.map((b) => b.id)).then((s) => {
      if (c) setFeaturedAdIds(s)
    })
    return () => {
      c = false
    }
  }, [filtered])

  const withDistOrdered = useMemo(() => {
    const ad = withDist.filter(({ b }) => featuredAdIds.has(b.id))
    const rest = withDist.filter(({ b }) => !featuredAdIds.has(b.id))
    return [...ad, ...rest]
  }, [withDist, featuredAdIds])

  const activeFiltersCount = useMemo(() => {
    let n = 0
    if (q.trim()) n += 1
    if (cityF.trim()) n += 1
    if (resolveSearchCategoryFilter(catLabelLocal).ok) n += 1
    if (parseFloat(minRating) > 0) n += 1
    if (sortBy !== 'rating') n += 1
    return n
  }, [q, cityF, catLabelLocal, minRating, sortBy])

  const applyCategoryFromHome = () => {
    const p = new URLSearchParams(params)
    if (catLabelLocal) p.set('categoryLabel', catLabelLocal)
    else p.delete('categoryLabel')
    setParams(p)
    setFilterOpen(false)
  }

  return (
    <div className="min-h-dvh bg-white pb-28 dark:bg-rosera-dark">
      <div className="sticky top-0 z-20 border-b border-[#F9A8C9]/25 bg-white px-4 py-3 shadow-sm dark:border-border dark:bg-card">
        <div className="relative mx-auto max-w-lg">
          <SearchIcon className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#BE185D]" />
          <Input
            className="h-12 rounded-2xl border-[#E5E7EB] bg-white ps-10 text-[#374151] shadow-sm focus-visible:ring-[#F9A8C9] dark:border-border dark:bg-card"
            placeholder={t('search.placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mx-auto mt-3 max-w-lg space-y-3">
          <SortPills
            value={sortBy}
            onChange={(v) => setSortBy(v)}
            ariaLabel={t('a11y.sortResults')}
            options={[
              { value: 'rating', label: t('city.sort.rating') },
              { value: 'booked', label: t('city.sort.booked') },
              { value: 'nearest', label: t('search.sortNearest') },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => setFilterOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              {t('search.filter')}
            </Button>
            <Button variant="ghost" size="sm" className="gap-1" onClick={resetSearchFilters}>
              {t('common.reset')}
              {activeFiltersCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F9A8C9] px-1 text-[10px] font-extrabold text-[#374151]">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            <Link
              to="/"
              className="text-sm font-semibold text-[#BE185D] transition-colors hover:text-[#9D174D] dark:text-primary"
            >
              {t('search.regionsLink')}
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
        {categoryBannerLabel && (
          <p className="mb-3 text-sm text-rosera-gray">
            {t('search.categoryChip')}{' '}
            <strong className="text-foreground">{categoryBannerLabel}</strong>
          </p>
        )}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-10">
            {resolveSearchCategoryFilter(catLabelLocal).ok ? (
              <EmptyState
                icon={SlidersHorizontal}
                title={t('search.emptyCategoryTitle')}
                subtitle={t('search.emptyCategorySub')}
                ctaLabel={t('search.emptyCategoryCtaFilter')}
                onClick={() => setFilterOpen(true)}
                analyticsSource="search_category_empty"
              >
                <Button
                  type="button"
                  variant="outline"
                  className="w-full max-w-sm rounded-2xl border-primary/25"
                  onClick={() =>
                    nav(
                      buildMapExploreUrl({
                        sortNearest: true,
                        searchQuery: q,
                        city: cityF.trim() || null,
                        categoryLabel: categoryBannerLabel,
                      })
                    )
                  }
                >
                  {t('search.emptyCategoryCtaMap')}
                </Button>
              </EmptyState>
            ) : (
              <EmptyState
                icon={MapPin}
                title={t('search.emptyStateTitle')}
                subtitle={t('search.emptyStateSub')}
                ctaLabel={t('search.emptyStateCtaNearest')}
                onClick={() =>
                  nav(
                    buildMapExploreUrl({
                      sortNearest: true,
                      searchQuery: q,
                      city: cityF.trim() || null,
                    })
                  )
                }
                analyticsSource="search"
              />
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {withDistOrdered.map(({ b, km }) => (
              <BusinessCard
                key={b.id}
                b={b}
                distanceKm={km}
                showFavorite
                isFeaturedAd={featuredAdIds.has(b.id)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{t('search.dialogTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('search.cityLabel')}</Label>
              <Input className="mt-2 rounded-xl" value={cityF} onChange={(e) => setCityF(e.target.value)} placeholder={t('search.cityPlaceholder')} />
            </div>
            <div>
              <Label>{t('search.categoryLabel')}</Label>
              <Select
                value={catLabelLocal || 'all'}
                onValueChange={(v) => {
                  const next = v === 'all' ? '' : v
                  setCatLabelLocal(next)
                  trackCategoryFilterSelected('search_filter', next || 'all')
                }}
              >
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue placeholder={t('common.all')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {SEARCH_BUSINESS_CATEGORY_OPTIONS.map(({ value, key }) => (
                    <SelectItem key={value} value={value}>
                      {t(key)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('search.minRating')}</Label>
              <Select value={minRating} onValueChange={setMinRating}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t('search.ratingAny')}</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                  <SelectItem value="4.5">4.5+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" variant="default" onClick={applyCategoryFromHome}>
              {t('common.apply')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
