import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { limitMarkersNearest } from '@/lib/mapMarkers'
import { GoogleMapView } from '@/components/map/GoogleMapView'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Crosshair, MapPin, ChevronLeft, RefreshCw } from 'lucide-react'
import { supabase, type Business } from '@/lib/supabase'
import { haversineKm } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { resolveBusinessCoverImage } from '@/lib/businessImages'
import { openNativeMapsDirections } from '@/lib/openNativeMapsDirections'
import { fetchGooglePlacesBeautySalons } from '@/lib/fetchGooglePlacesBeauty'
import {
  dedupeBusinessesForDisplay,
  filterFemaleBeautyBusinesses,
} from '@/lib/roseraBusinessFilters'
import { GOOGLE_MAPS_API_KEY_EMBEDDED } from '@/config/googleMapsApiKey'
import { tr } from '@/lib/i18n'

/** مساحة آمنة أسفل الخريطة: شريط التنقل + ~100px + منطقة آمنة */
const MAP_BOTTOM_SAFE =
  'calc(5rem + env(safe-area-inset-bottom, 0px) + 100px)'

/** Padding (px) passed to Google Maps — شريط سفلي + مساحة فوق زر الرجوع العائم */
const GOOGLE_MAP_BOTTOM_PADDING_PX = 152
/** حشوة يمين/يسار داخل الخريطة حتى لا تغطي الشارات/التحكم أزرار الواجهة */
const GOOGLE_MAP_PAD_LEFT_PX = 88
const GOOGLE_MAP_PAD_RIGHT_PX = 32

const DEFAULT_CENTER: [number, number] = [26.2172, 50.1971] // Al Khobar (fallback if GPS unavailable)
const DEFAULT_ZOOM = 12
const MAP_PREFS_KEY = 'rosera:map:prefs'
/** sonner id — يُزال تلقائياً عند نجاح الجلب */
const MAP_DATA_ERROR_TOAST_ID = 'rosera-map-data-error'
/** أقل مسافة (م) لتحديث نقطة المستخدم من watchPosition — يقلّل وميض الـ Blue Dot */
const GEO_WATCH_MIN_MOVE_METERS = 10

function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const la = Number(lat)
  const ln = Number(lng)
  return Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180
}

/** يطابق نص المنطقة في جدول businesses (الشرقية، المنطقة الشرقية، Google Places، إلخ) */
function isEasternProvinceRegion(region: string | null | undefined): boolean {
  const r = (region ?? '').trim()
  if (!r) return false
  return (
    r.includes('الشرقية') ||
    r.includes('المنطقة الشرقية') ||
    /eastern province/i.test(r) ||
    /^eastern\b/i.test(r)
  )
}

export default function MapPage() {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const storedPrefs = (() => {
    try {
      return JSON.parse(localStorage.getItem(MAP_PREFS_KEY) || '{}') as {
        q?: string
        region?: 'all' | 'eastern'
        sort?: 'rating' | 'booked' | 'nearest' | 'name' | 'newest'
      }
    } catch {
      return {}
    }
  })()

  const initialQ = params.get('q') ?? storedPrefs.q ?? ''
  const initialRegion = params.get('region') === 'all' ? 'all' : (storedPrefs.region ?? 'eastern')
  const urlSort = params.get('sort')
  const initialSort =
    urlSort === 'booked' || urlSort === 'nearest' || urlSort === 'rating' || urlSort === 'name' || urlSort === 'newest'
      ? urlSort
      : (storedPrefs.sort ?? 'rating')

  const [businesses, setBusinesses] = useState<Business[]>([])
  /** أماكن حقيقية من Google Places (الخبر + الدمام) — تُدمج مع Supabase */
  const [googlePlaces, setGooglePlaces] = useState<Business[]>([])
  const [mapLoading, setMapLoading] = useState(true)
  const [q, setQ] = useState(initialQ)
  const [selected, setSelected] = useState<Business | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM)
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [nearestSheetOpen, setNearestSheetOpen] = useState(false)
  const [regionFilter, setRegionFilter] = useState<'all' | 'eastern'>(initialRegion)
  const [sortBy, setSortBy] = useState<'rating' | 'booked' | 'nearest' | 'name' | 'newest'>(initialSort)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const fetchFailureNotified = useRef(false)
  const locationDeniedNotified = useRef(false)
  /** طلبات جلب متزامنة مع busyIndicator — لا نُطفئ التحميل حتى ينتهي آخر طلب «مزدحم» */
  const mapFetchBusyCount = useRef(0)
  /** آخر موقع طُبِّقَ كتحديث للعلامة — لفرض حد أدنى للمسافة (م) */
  const lastReportedUserPosRef = useRef<[number, number] | null>(null)
  /** مركز الخريطة على المستخدم مرة واحدة عند أول إحداثيات ناجحة من getCurrentPosition فقط */
  const hasAutoCenteredOnGpsRef = useRef(false)
  /** يُزال «جاري التحديث» بعد أول إحداثيات ناجحة (حتى لا يبقى عالقاً إذا تأخر جلب المنشآت) */
  const clearedMapLoadingAfterFirstCoordsRef = useRef(false)

  const openDirections = (
    lat: number | null | undefined,
    lng: number | null | undefined,
    label?: string | null
  ) => {
    if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      toast.error(t('map.coordsMissing'))
      return
    }
    openNativeMapsDirections(lat, lng, label ?? undefined)
  }

  const resetMapFilters = () => {
    setQ('')
    setRegionFilter('eastern')
    setSortBy('rating')
    setSelected(null)
    setNearestSheetOpen(false)
    setMapCenter(DEFAULT_CENTER)
    setMapZoom(DEFAULT_ZOOM)
    localStorage.removeItem(MAP_PREFS_KEY)
    setParams(new URLSearchParams(), { replace: true })
    toast.success(t('map.resetToast'))
  }

  const fetchBusinesses = useCallback(
    async (opts?: { showToast?: boolean; busyIndicator?: boolean; suppressErrorToast?: boolean }) => {
      const busy = opts?.busyIndicator ?? true
      let safetyClear: ReturnType<typeof setTimeout> | null = null
      if (busy) {
        mapFetchBusyCount.current += 1
        setMapLoading(true)
        safetyClear = setTimeout(() => {
          if (import.meta.env.DEV) {
            console.warn('[MapPage] businesses fetch safety timeout — forcing mapLoading off')
          }
          mapFetchBusyCount.current = 0
          setMapLoading(false)
        }, 55_000)
      }
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('is_active', true)
          .eq('is_demo', false)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
        if (error) throw error
        const rows = Array.isArray(data) ? (data as Business[]) : []
        setBusinesses(rows)

        let placesCount = 0
        const gKey = GOOGLE_MAPS_API_KEY_EMBEDDED.trim()
        if (gKey) {
          try {
            const places = await fetchGooglePlacesBeautySalons(gKey)
            setGooglePlaces(places)
            placesCount = places.length
          } catch (pe) {
            if (import.meta.env.DEV) console.warn('[MapPage] Google Places fetch failed', pe)
            setGooglePlaces([])
          }
        } else {
          setGooglePlaces([])
        }

        fetchFailureNotified.current = false
        toast.dismiss(MAP_DATA_ERROR_TOAST_ID)
        if (opts?.showToast) {
          toast.success(tr(lang, 'map.refreshed', { count: rows.length + placesCount }))
        }
      } catch (e) {
        console.error('[MapPage] businesses fetch failed', e)
        if (opts?.showToast) {
          toast.error(tr(lang, 'map.dataLoadError'), { id: MAP_DATA_ERROR_TOAST_ID })
        } else if (!opts?.suppressErrorToast && busy && !fetchFailureNotified.current) {
          fetchFailureNotified.current = true
          toast.error(tr(lang, 'map.dataLoadError'), { id: MAP_DATA_ERROR_TOAST_ID })
        }
      } finally {
        if (safetyClear) clearTimeout(safetyClear)
        if (busy) {
          mapFetchBusyCount.current = Math.max(0, mapFetchBusyCount.current - 1)
          if (mapFetchBusyCount.current === 0) setMapLoading(false)
        }
      }
    },
    [lang]
  )

  useEffect(() => {
    void fetchBusinesses({ busyIndicator: true })
  }, [fetchBusinesses])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const g = GOOGLE_MAPS_API_KEY_EMBEDDED.trim()
    if (!g) console.warn('[MapPage] embedded Google Maps key missing (googleMapsApiKey.ts)')
  }, [])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        void fetchBusinesses({ busyIndicator: false, suppressErrorToast: true })
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [fetchBusinesses])

  const focusRefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const onFocus = () => {
      if (focusRefetchTimer.current) clearTimeout(focusRefetchTimer.current)
      focusRefetchTimer.current = setTimeout(() => {
        void fetchBusinesses({ busyIndicator: false, suppressErrorToast: true })
      }, 1500)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      if (focusRefetchTimer.current) clearTimeout(focusRefetchTimer.current)
    }
  }, [fetchBusinesses])

  useEffect(() => {
    if (sortBy === 'name') {
      const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 150)
      return () => window.clearTimeout(focusTimer)
    }
  }, [sortBy])

  useEffect(() => {
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    else p.delete('q')
    p.set('region', regionFilter)
    p.set('sort', sortBy)
    setParams(p, { replace: true })
    localStorage.setItem(
      MAP_PREFS_KEY,
      JSON.stringify({
        q: q.trim(),
        region: regionFilter,
        sort: sortBy,
      })
    )
  }, [q, regionFilter, sortBy, setParams])

  useEffect(() => {
    if (!navigator.geolocation) return
    const geo = navigator.geolocation
    const acc = { enableHighAccuracy: true, timeout: 22000, maximumAge: 0 }

    const tryClearMapLoadingAfterFirstCoords = () => {
      if (clearedMapLoadingAfterFirstCoordsRef.current) return
      clearedMapLoadingAfterFirstCoordsRef.current = true
      mapFetchBusyCount.current = 0
      setMapLoading(false)
    }

    geo.getCurrentPosition(
      (p) => {
        const lat = p.coords?.latitude
        const lng = p.coords?.longitude
        if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
          return
        }
        const pos: [number, number] = [lat, lng]
        tryClearMapLoadingAfterFirstCoords()
        setUserPos(pos)
        lastReportedUserPosRef.current = pos
        /** مركز الخريطة على المستخدم مرة واحدة فقط عند التحميل — لا يتبع الـ watch */
        if (!hasAutoCenteredOnGpsRef.current) {
          hasAutoCenteredOnGpsRef.current = true
          setMapCenter(pos)
          setMapZoom(14)
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          if (!locationDeniedNotified.current) {
            locationDeniedNotified.current = true
            toast.error(tr(lang, 'map.locationDenied'))
          }
          setMapCenter(DEFAULT_CENTER)
          setMapZoom(DEFAULT_ZOOM)
          return
        }
        /** مهلة/خطأ آخر: لا نُرجع الخريطة للافتراضي — قد ينجح watchPosition لاحقاً */
        if (import.meta.env.DEV) console.warn('[MapPage] getCurrentPosition', err.code)
      },
      acc
    )

    let watchId: number | undefined
    try {
      watchId = geo.watchPosition(
        (p) => {
          const lat = p.coords?.latitude
          const lng = p.coords?.longitude
          if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            return
          }
          const last = lastReportedUserPosRef.current
          if (last) {
            const meters = haversineKm(last[0], last[1], lat, lng) * 1000
            if (meters < GEO_WATCH_MIN_MOVE_METERS) return
          }
          tryClearMapLoadingAfterFirstCoords()
          const next: [number, number] = [lat, lng]
          lastReportedUserPosRef.current = next
          setUserPos(next)
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 15000, timeout: 60000 }
      )
    } catch {
      /* watchPosition غير مدعوم أو فشل صامت */
    }

    return () => {
      if (watchId != null) {
        try {
          geo.clearWatch(watchId)
        } catch {
          /* ignore */
        }
      }
    }
  }, [lang])

  const centerOnUser = useCallback(
    (opts?: { openNearest?: boolean }) => {
      if (!navigator.geolocation) {
        toast.error(tr(lang, 'map.locationUnavailable'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const lat = p.coords?.latitude
          const lng = p.coords?.longitude
          if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            toast.error(tr(lang, 'map.enableLocation'))
            return
          }
          const pos: [number, number] = [lat, lng]
          setUserPos(pos)
          setMapCenter(pos)
          setMapZoom(14)
          if (opts?.openNearest) setNearestSheetOpen(true)
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            toast.error(tr(lang, 'map.locationDenied'))
          } else if (err.code === err.TIMEOUT) {
            toast.error(tr(lang, 'map.locationTimeout'))
          } else {
            toast.error(tr(lang, 'map.enableLocation'))
          }
        },
        { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 }
      )
    },
    [lang]
  )

  const businessesSafe = useMemo(() => {
    const a = Array.isArray(businesses) ? businesses : []
    const b = Array.isArray(googlePlaces) ? googlePlaces : []
    const merged = dedupeBusinessesForDisplay([...a, ...b])
    return filterFemaleBeautyBusinesses(merged)
  }, [businesses, googlePlaces])

  const filtered = useMemo(() => {
    const qq = q.trim()
    let rows = businessesSafe.filter((b) => {
      const inText =
        !qq ||
        (b.name_ar ?? '').includes(qq) ||
        (b.city ?? '').includes(qq) ||
        (b.region && b.region.includes(qq)) ||
        (b.category_label && b.category_label.includes(qq))
      const inRegion = regionFilter === 'all' || isEasternProvinceRegion(b.region)
      return inText && inRegion
    })

    rows = rows.filter(
      (b) =>
        b.latitude != null &&
        b.longitude != null &&
        Number.isFinite(Number(b.latitude)) &&
        Number.isFinite(Number(b.longitude))
    )

    if (sortBy === 'rating') {
      rows = [...rows].sort(
        (a, b) =>
          Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0) ||
          Number(b.total_reviews ?? 0) - Number(a.total_reviews ?? 0)
      )
    } else if (sortBy === 'booked') {
      rows = [...rows].sort(
        (a, b) =>
          Number(b.total_bookings ?? 0) - Number(a.total_bookings ?? 0) ||
          Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0)
      )
    } else if (sortBy === 'nearest' && Array.isArray(userPos) && userPos.length >= 2) {
      rows = [...rows].sort(
        (a, b) =>
          haversineKm(userPos[0], userPos[1], a.latitude!, a.longitude!) -
          haversineKm(userPos[0], userPos[1], b.latitude!, b.longitude!)
      )
    } else if (sortBy === 'name') {
      rows = [...rows].sort((a, b) => (a.name_ar ?? '').localeCompare(b.name_ar ?? '', 'ar'))
    } else if (sortBy === 'newest') {
      rows = [...rows].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta
      })
    }
    return rows
  }, [businessesSafe, q, regionFilter, sortBy, userPos])

  /** صفوف جاهزة للـ Marker — إحداثيات رقمية صالحة فقط */
  const ratingPinFmt = useMemo(
    () =>
      new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [lang]
  )

  const mapMarkers = useMemo(() => {
    return filtered
      .filter((b) => b.id != null && isValidLatLng(b.latitude, b.longitude))
      .map((b) => {
        const r = Number(b.average_rating ?? 0)
        return {
          id: String(b.id),
          b,
          position: [Number(b.latitude), Number(b.longitude)] as [number, number],
          rating: r,
          pinRatingLabel: ratingPinFmt.format(r),
        }
      })
  }, [filtered, ratingPinFmt])

  const activeFiltersCount = useMemo(() => {
    let n = 0
    if (q.trim()) n += 1
    if (regionFilter !== 'eastern') n += 1
    if (sortBy !== 'rating') n += 1
    return n
  }, [q, regionFilter, sortBy])

  const handleSortChange = (v: string) => {
    setSortBy(v as 'rating' | 'booked' | 'nearest' | 'name' | 'newest')
  }

  const nearestWithKm = useMemo(() => {
    if (!Array.isArray(userPos) || userPos.length < 2) return filtered.map((b) => ({ b, km: 0 }))
    return filtered
      .map((b) => ({ b, km: haversineKm(userPos[0], userPos[1], b.latitude!, b.longitude!) }))
      .sort((a, b) => a.km - b.km)
  }, [filtered, userPos])

  const goToNearest = () => centerOnUser({ openNearest: true })

  /** أرقام فقط في deps — لا يُعاد إنشاء مصفوفة جديدة إلا عند تغيّر الإحداثيات فعلياً */
  const safeMapCenter: [number, number] = useMemo(() => {
    if (!Array.isArray(mapCenter) || mapCenter.length < 2) return DEFAULT_CENTER
    const [a, b] = mapCenter
    if (isValidLatLng(a, b)) return [Number(a), Number(b)]
    return DEFAULT_CENTER
  }, [mapCenter[0], mapCenter[1]])

  const handleMarkerSelect = useCallback((b: Business, position: [number, number]) => {
    setSelected(b)
    setMapCenter(position)
    setMapZoom(13)
  }, [])

  /**
   * مرجع «أقرب N» علامة — يعتمد على مركز الخريطة البرمجي فقط (لا يتبع كل حدث idle ولا تحديث GPS الدوري)
   * حتى لا تُعاد ترتيب العلامات باستمرار ويحدث وميض.
   */
  const refForMarkerLimit = useMemo((): [number, number] => safeMapCenter, [safeMapCenter])

  /** أقرب N علامة للخريطة؛ القائمة والبحث يظهران الكل */
  const mapMarkersToShow = useMemo(() => {
    return limitMarkersNearest(mapMarkers, refForMarkerLimit[0], refForMarkerLimit[1])
  }, [mapMarkers, refForMarkerLimit])

  /** توقيع ثابت للـ memo — لا يعتمد على مرجع المصفوفة فقط */
  const mapMarkersSignature = useMemo(
    () =>
      mapMarkersToShow
        .map(
          (m) =>
            `${m.id}:${m.position[0].toFixed(5)},${m.position[1].toFixed(5)}:${m.pinRatingLabel}:${m.rating.toFixed(2)}`
        )
        .join('|'),
    [mapMarkersToShow]
  )

  return (
    <div
      className="rosera-map-page fixed inset-0 z-10 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-rosera-dark"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <button
        type="button"
        onClick={() => nav('/home')}
        className="absolute start-3 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-[600] inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#1F1F1F] shadow-lg hover:bg-white/95 dark:bg-card dark:text-white"
        style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
      >
        <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
        {lang === 'ar' ? 'الرئيسية' : 'Home'}
      </button>
      <div className="absolute start-0 end-0 top-0 z-[500] space-y-2 p-3 pt-safe" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="relative mx-auto max-w-lg">
          <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-rosera-gray" />
          <Input
            ref={searchInputRef}
            className="rounded-2xl bg-white/95 ps-10 shadow-lg"
            placeholder={sortBy === 'name' ? t('map.searchByNamePh') : t('map.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={regionFilter === 'eastern' ? 'default' : 'secondary'}
            className="rounded-full"
            onClick={() => setRegionFilter(regionFilter === 'eastern' ? 'all' : 'eastern')}
          >
            {regionFilter === 'eastern' ? t('map.regionEasternOn') : t('map.regionEastern')}
          </Button>
          <Select value={sortBy} onValueChange={handleSortChange}>
            <SelectTrigger className="h-9 max-w-[9.5rem] rounded-full bg-white/95 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rating">{t('city.sort.rating')}</SelectItem>
              <SelectItem value="booked">{t('city.sort.booked')}</SelectItem>
              <SelectItem value="nearest">{t('search.sortNearest')}</SelectItem>
              <SelectItem value="name">{t('map.sortByName')}</SelectItem>
              <SelectItem value="newest">{t('map.sortNewest')}</SelectItem>
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="ghost" className="rounded-full text-xs gap-1" onClick={resetMapFilters}>
            {t('common.reset')}
            {activeFiltersCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-extrabold text-white">
                {activeFiltersCount}
              </span>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-full text-xs gap-1"
            disabled={mapLoading}
            onClick={() => void fetchBusinesses({ showToast: true, busyIndicator: true })}
            title={lang === 'ar' ? 'إعادة جلب المنشآت من السيرفر' : 'Reload places from server'}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${mapLoading ? 'animate-spin' : ''}`} aria-hidden />
            {mapLoading ? t('map.refreshing') : t('map.refresh')}
          </Button>
        </div>
        <div className="flex justify-center mt-2" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <Button
            type="button"
            size="sm"
            className="rounded-full border-2 border-white bg-[#9B2257] text-base font-bold text-white shadow-lg gap-1.5 hover:bg-[#9B2257]/90"
            onClick={goToNearest}
          >
            <MapPin className="h-5 w-5 text-white" aria-hidden />
            {t('map.nearestBtn')}
          </Button>
        </div>
      </div>

      <div
        className="rosera-map-shell relative z-0 flex min-h-0 w-full flex-1 basis-0 overflow-hidden pb-[calc(5rem+env(safe-area-inset-bottom,0px)+100px)]"
        style={{ minHeight: 0 }}
        dir="ltr"
      >
        <GoogleMapView
          centerLat={safeMapCenter[0]}
          centerLng={safeMapCenter[1]}
          zoom={mapZoom}
          markers={mapMarkersToShow}
          markersSignature={mapMarkersSignature}
          userPosition={
            Array.isArray(userPos) && userPos.length >= 2 && Number.isFinite(userPos[0]) && Number.isFinite(userPos[1])
              ? userPos
              : null
          }
          onMarkerClick={handleMarkerSelect}
          bottomPaddingPx={GOOGLE_MAP_BOTTOM_PADDING_PX}
          leftPaddingPx={GOOGLE_MAP_PAD_LEFT_PX}
          rightPaddingPx={GOOGLE_MAP_PAD_RIGHT_PX}
        />
      </div>

      <Button
        type="button"
        size="icon"
        className="absolute right-4 z-[500] h-12 w-12 rounded-full border-0 bg-gradient-to-br from-[#9C27B0] to-[#E91E8C] shadow-lg"
        style={{ bottom: MAP_BOTTOM_SAFE }}
        onClick={() => centerOnUser()}
        aria-label={lang === 'ar' ? 'توسيط الخريطة على موقعك' : 'Center map on your location'}
      >
        <Crosshair className="h-6 w-6 text-white" />
      </Button>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute left-4 z-[500] rounded-full shadow-lg"
        style={{ bottom: MAP_BOTTOM_SAFE }}
        onClick={() => {
          setMapCenter(DEFAULT_CENTER)
          setMapZoom(DEFAULT_ZOOM)
          setSelected(null)
        }}
      >
        {t('map.saudiOverview')}
      </Button>

      {selected && (
        <div
          className="absolute start-4 end-4 z-[500] max-w-lg mx-auto animate-in slide-in-from-bottom-4"
          style={{
            bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px) + 100px + 3.75rem)',
          }}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <Card className="relative overflow-hidden border-primary/20 p-4 shadow-2xl">
            <button type="button" className="absolute top-2 end-2 z-10 text-rosera-gray" onClick={() => setSelected(null)}>
              ✕
            </button>
            <div className="min-w-0 pe-8">
              <p dir="auto" className="text-start font-bold text-foreground line-clamp-2">
                {selected.name_ar}
              </p>
              <div
                dir="ltr"
                style={{ unicodeBidi: 'isolate' }}
                className="mt-1 flex items-center justify-start gap-1 text-[#9B2257]"
              >
                <Star className="h-4 w-4 shrink-0 fill-[#9B2257] text-[#9B2257]" aria-hidden />
                <span className="tabular-nums font-semibold">
                  {ratingPinFmt.format(Number(selected.average_rating ?? 0))}
                </span>
              </div>
              {userPos && selected.latitude != null && selected.longitude != null && (
                <p className="text-xs text-rosera-gray">
                  {haversineKm(userPos[0], userPos[1], selected.latitude, selected.longitude).toFixed(1)} {t('common.km')}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="rounded-xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
                  onClick={() => {
                    if (selected.is_google_place) {
                      if (selected.google_maps_uri) {
                        window.open(selected.google_maps_uri, '_blank', 'noopener,noreferrer')
                      } else {
                        openNativeMapsDirections(selected.latitude, selected.longitude, selected.name_ar)
                      }
                      return
                    }
                    nav('/salon/' + selected.id)
                  }}
                >
                  {selected.is_google_place ? t('map.openInGoogleMaps') : t('map.viewDetails')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => openDirections(selected.latitude, selected.longitude, selected.name_ar)}
                >
                  {t('map.directions')}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {nearestSheetOpen && (
        <div className="absolute bottom-0 start-0 end-0 z-[500] max-h-[45vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-card" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className="sticky top-0 flex items-center justify-between border-b border-primary/10 bg-white p-4 dark:bg-card">
            <h3 className="font-bold">{t('map.nearestSheetTitle')}</h3>
            <button type="button" className="text-rosera-gray" onClick={() => setNearestSheetOpen(false)}>✕</button>
          </div>
          <ul className="overflow-y-auto p-4 space-y-2 max-h-[38vh]">
            {nearestWithKm.slice(0, 15).map(({ b, km }) => (
              <li key={b.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl border border-primary/10 p-3 text-start"
                  onClick={() => {
                    if (!isValidLatLng(b.latitude, b.longitude)) return
                    setSelected(b)
                    setMapCenter([Number(b.latitude), Number(b.longitude)])
                    setMapZoom(14)
                    setNearestSheetOpen(false)
                  }}
                >
                  <img src={resolveBusinessCoverImage(b)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="text-start font-bold line-clamp-1">
                      {b.name_ar}
                    </p>
                    <p dir="ltr" className="text-start text-xs tabular-nums text-rosera-gray">
                      {Number(km).toFixed(1)} {t('common.km')} ·{' '}
                      {ratingPinFmt.format(Number(b.average_rating ?? 0))} ★
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
