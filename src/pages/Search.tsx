import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react'
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
import { haversineKm } from '@/lib/utils'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { filterFemaleBeautyBusinesses } from '@/lib/roseraBusinessFilters'

type BizRow = Business & {
  sa_cities?: { name_ar: string; sa_regions?: { name_ar: string } | null } | null
}

const SEARCH_SORT_PREFS_KEY = 'rosera:search:sort'

const CATEGORY_OPTIONS: { value: string; key: string }[] = [
  { value: 'صالون نسائي', key: 'search.cat.salon_female' },
  { value: 'سبا ومساج', key: 'search.cat.spa_massage' },
  { value: 'مكياج', key: 'search.cat.makeup' },
  { value: 'عناية بالبشرة', key: 'search.cat.skincare' },
  { value: 'عيادة تجميل', key: 'search.cat.clinic_beauty' },
  { value: 'عيادة جلدية', key: 'search.cat.clinic_skin' },
  { value: 'عيادة ليزر', key: 'search.cat.clinic_laser' },
  { value: 'عيادة حقن وفيلر', key: 'search.cat.clinic_filler' },
]

export default function SearchPage() {
  const { t } = useI18n()
  const { lang } = usePreferences()
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

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    )
  }, [])

  useEffect(() => {
    localStorage.setItem(SEARCH_SORT_PREFS_KEY, sortBy)
  }, [sortBy])

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
    if (catLabelLocal.trim()) {
      const cat = catLabelLocal.trim()
      r = r.filter((b) => {
        const lbl = (b.category_label ?? '').trim()
        if (lbl.includes(cat) || lbl === cat || cat.includes(lbl)) return true
        const hay = `${lbl} ${b.name_ar ?? ''} ${b.description_ar ?? ''} ${b.category ?? ''}`
        return hay.includes(cat)
      })
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
    } else if (sortBy === 'nearest' && userPos) {
      r = [...r].sort((a, b) => {
        if (!a.latitude || !a.longitude) return 1
        if (!b.latitude || !b.longitude) return -1
        return haversineKm(userPos.lat, userPos.lng, a.latitude, a.longitude) - haversineKm(userPos.lat, userPos.lng, b.latitude, b.longitude)
      })
    }
    return r
  }, [list, q, cityF, catLabelLocal, minRating, sortBy, userPos])

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

  const activeFiltersCount = useMemo(() => {
    let n = 0
    if (q.trim()) n += 1
    if (cityF.trim()) n += 1
    if (catLabelLocal.trim()) n += 1
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
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <div className="sticky top-0 z-20 border-b border-primary/10 bg-gradient-to-b from-white to-[#fff5fb] px-4 py-3 dark:from-card dark:to-rosera-dark">
        <div className="relative mx-auto max-w-lg">
          <SearchIcon className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9C27B0]" />
          <Input
            className="h-12 rounded-2xl border-primary/15 ps-10 shadow-sm"
            placeholder={t('search.placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mx-auto mt-3 flex max-w-lg items-center justify-between gap-2">
          <Button variant="outline" size="sm" className="gap-1 rounded-full border-primary/20" onClick={() => setFilterOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            {t('search.filter')}
          </Button>
          <Select value={sortBy} onValueChange={(v: 'rating' | 'booked' | 'nearest') => setSortBy(v)}>
            <SelectTrigger className="h-9 w-[150px] rounded-full bg-white text-xs dark:bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">{t('city.sort.rating')}</SelectItem>
              <SelectItem value="booked">{t('city.sort.booked')}</SelectItem>
              <SelectItem value="nearest">{t('search.sortNearest')}</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="rounded-full gap-1" onClick={resetSearchFilters}>
            {t('common.reset')}
            {activeFiltersCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Link to="/" className="text-sm font-bold text-primary">
            {t('search.regionsLink')}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
        {categoryLabelF && (
          <p className="mb-3 text-sm text-rosera-gray">
            {t('search.categoryChip')} <strong className="text-foreground">{categoryLabelF}</strong>
          </p>
        )}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-lg text-rosera-gray">{t('search.noResults')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {withDist.map(({ b, km }) => (
              <BusinessCard key={b.id} b={b} distanceKm={km} showFavorite />
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
              <Select value={catLabelLocal || 'all'} onValueChange={(v) => setCatLabelLocal(v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue placeholder={t('common.all')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {CATEGORY_OPTIONS.map(({ value, key }) => (
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
            <Button className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={applyCategoryFromHome}>
              {t('common.apply')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
