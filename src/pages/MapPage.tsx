import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { GoogleMapView } from '@/components/map/GoogleMapView'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Search, Crosshair, ChevronLeft, RefreshCw } from 'lucide-react'
import { supabase, type Business } from '@/lib/supabase'
import { haversineKm, cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SortPills } from '@/components/ui/sort-pills'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { openNativeMapsDirections } from '@/lib/openNativeMapsDirections'
import { fetchGooglePlacesBeautySalons } from '@/lib/fetchGooglePlacesBeauty'
import { dedupeBusinessesForDisplay, filterMapDisplayBusinesses } from '@/lib/roseraBusinessFilters'
import { GOOGLE_MAPS_API_KEY_EMBEDDED } from '@/config/googleMapsApiKey'
import { tr } from '@/lib/i18n'
import { hasGeolocationKnown, markGeolocationKnown } from '@/lib/geoSession'

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
/** تقريب أقرب عند أول تحديد للموقع أو زر التمركز */
const USER_LOCATION_ZOOM = 16
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

/** مدن وبلدات شائعة في الشرقية — يُكمّل حقل `region` إن كان فارغًا أو غير متطابق */
const EASTERN_CITY_KEYWORDS = [
  'الخبر',
  'الدمام',
  'الظهران',
  'الأحساء',
  'الاحساء',
  'حفر الباطن',
  'الجبيل',
  'القطيف',
  'الخفجي',
  'رأس تنورة',
  'بقيق',
  'النعيرية',
  'قرية العليا',
  'العديد',
  'الهفوف',
  'المبرز',
  'العيون',
]

/** تقريبًا: شبه جزيرة الشرقية داخل السعودية (إحداثيات WGS84) */
function isInEasternProvinceBBox(lat: number, lng: number): boolean {
  return lat >= 22.2 && lat <= 28.85 && lng >= 47.8 && lng <= 55.85
}

const EASTERN_EN_KEYWORDS = [
  'khobar',
  'dammam',
  'dhahran',
  'al ahsa',
  'al hasa',
  'hofuf',
  'hufuf',
  'khafji',
  'nairiyah',
  'jubail',
  'qatif',
  'ras tanura',
  'eastern province',
  'ash sharqiyah',
]

/** تطابق مدن الشرقية في `city` أو في الاسم (عربي/إنجليزي) لتفادي اختلاف التسمية في البيانات */
function matchesEasternCityOrName(b: Pick<Business, 'city' | 'name_ar' | 'name_en'>): boolean {
  const blob = [b.city, b.name_ar, b.name_en].filter(Boolean).join(' ')
  if (!blob.trim()) return false
  if (EASTERN_CITY_KEYWORDS.some((k) => blob.includes(k))) return true
  const low = blob.toLowerCase()
  return EASTERN_EN_KEYWORDS.some((k) => low.includes(k))
}

/** تضمين منشأة عند فلتر «الشرقية» — منطقة، أو مدينة معروفة، أو إحداثيات داخل الصندوق */
function isEasternProvinceBusiness(b: Business): boolean {
  if (isEasternProvinceRegion(b.region)) return true
  if (matchesEasternCityOrName(b)) return true
  const la = Number(b.latitude)
  const ln = Number(b.longitude)
  if (Number.isFinite(la) && Number.isFinite(ln) && isInEasternProvinceBBox(la, ln)) return true
  return false
}

function normalizeBusinessCoords(row: Business): Business {
  const rawLat = row.latitude as unknown
  const rawLng = row.longitude as unknown
  const lat =
    rawLat == null || rawLat === ''
      ? undefined
      : Number(rawLat)
  const lng =
    rawLng == null || rawLng === ''
      ? undefined
      : Number(rawLng)
  const latitude = lat != null && Number.isFinite(lat) ? lat : undefined
  const longitude = lng != null && Number.isFinite(lng) ? lng : undefined
  return { ...row, latitude, longitude }
}

export default function MapPage() {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const nav = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const storedPrefs = (() => {
    try {
      return JSON.parse(localStorage.getItem(MAP_PREFS_KEY) || '{}') as {
        q?: string
        region?: 'all' | 'eastern'
        sort?: 'rating' | 'booked' | 'nearest' | 'name' | 'newest'
        city?: string
      }
    } catch {
      return {}
    }
  })()

  const initialQ = params.get('q') ?? storedPrefs.q ?? ''
  const urlRegion = params.get('region')
  const initialRegion: 'all' | 'eastern' =
    urlRegion === 'all' || urlRegion === 'eastern'
      ? urlRegion
      : storedPrefs.region === 'eastern' || storedPrefs.region === 'all'
        ? storedPrefs.region
        : 'all'
  const urlSortRaw = params.get('sort')
  const urlSort =
    urlSortRaw === 'booked' ||
    urlSortRaw === 'nearest' ||
    urlSortRaw === 'rating' ||
    urlSortRaw === 'name' ||
    urlSortRaw === 'newest'
      ? urlSortRaw
      : null
  const initialSort =
    urlSort ?? (hasGeolocationKnown() ? 'nearest' : (storedPrefs.sort ?? 'rating'))
  const initialCity = params.get('city') ?? storedPrefs.city ?? ''

  const [businesses, setBusinesses] = useState<Business[]>([])
  /** أماكن حقيقية من Google Places (الخبر + الدمام) — تُدمج مع Supabase */
  const [googlePlaces, setGooglePlaces] = useState<Business[]>([])
  const [mapLoading, setMapLoading] = useState(true)
  const [q, setQ] = useState(initialQ)
  const [selected, setSelected] = useState<Business | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM)
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [regionFilter, setRegionFilter] = useState<'all' | 'eastern'>(initialRegion)
  const [sortBy, setSortBy] = useState<'rating' | 'booked' | 'nearest' | 'name' | 'newest'>(initialSort)
  const [mapCity, setMapCity] = useState(initialCity)
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
  /** مزامنة `city` من الرابط عند الانتقال من صفحات أخرى (بدون مسح المدينة المحفوظة إذا لم يكن `city` في الـ URL) */
  const lastMapSearchSyncedRef = useRef<string | null>(null)

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
    setMapCity('')
    setRegionFilter('eastern')
    setSortBy('rating')
    setSelected(null)
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
          mapFetchBusyCount.current = 0
          setMapLoading(false)
        }, 55_000)
      }
      let supabaseOk = false
      let placesCount = 0
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('is_active', true)
          .eq('is_demo', false)
        if (error) throw error
        const rows = Array.isArray(data) ? (data as Business[]).map(normalizeBusinessCoords) : []
        setBusinesses(rows)
        supabaseOk = true

        /** إظهار الخريطة فوراً ببيانات Supabase — Google Places يُكمّل لاحقاً دون حجب التحميل */
        if (busy) {
          mapFetchBusyCount.current = Math.max(0, mapFetchBusyCount.current - 1)
          if (mapFetchBusyCount.current === 0) setMapLoading(false)
        }
        if (safetyClear) {
          clearTimeout(safetyClear)
          safetyClear = null
        }

        const gKey = GOOGLE_MAPS_API_KEY_EMBEDDED.trim()
        if (gKey) {
          try {
            const places = await fetchGooglePlacesBeautySalons(gKey)
            setGooglePlaces(places.map(normalizeBusinessCoords))
            placesCount = places.length
          } catch {
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
      } catch {
        if (!supabaseOk) {
          setBusinesses([])
          setGooglePlaces([])
        }
        if (busy && !supabaseOk) {
          mapFetchBusyCount.current = Math.max(0, mapFetchBusyCount.current - 1)
          if (mapFetchBusyCount.current === 0) setMapLoading(false)
        }
        if (opts?.showToast) {
          toast.error(tr(lang, 'map.dataLoadError'), { id: MAP_DATA_ERROR_TOAST_ID })
        } else if (!opts?.suppressErrorToast && busy && !fetchFailureNotified.current) {
          fetchFailureNotified.current = true
          toast.error(tr(lang, 'map.dataLoadError'), { id: MAP_DATA_ERROR_TOAST_ID })
        }
      } finally {
        if (safetyClear) clearTimeout(safetyClear)
      }
    },
    [lang]
  )

  useEffect(() => {
    void fetchBusinesses({ busyIndicator: true })
  }, [fetchBusinesses])

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
    if (sortBy !== 'nearest') return
    if (!navigator.geolocation) return
    if (Array.isArray(userPos) && userPos.length >= 2) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const lat = p.coords?.latitude
        const lng = p.coords?.longitude
        if (typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng)) {
          markGeolocationKnown()
          setUserPos([lat, lng])
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 }
    )
  }, [sortBy, userPos])

  useEffect(() => {
    const s = location.search
    if (lastMapSearchSyncedRef.current === s) return
    lastMapSearchSyncedRef.current = s
    const sp = new URLSearchParams(s)
    if (sp.has('city')) {
      const c = sp.get('city') ?? ''
      setMapCity((prev) => (prev === c ? prev : c))
    }
  }, [location.search])

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const focusKeep = sp.get('focus')
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    else p.delete('q')
    p.set('region', regionFilter)
    p.set('sort', sortBy)
    const ct = mapCity.trim()
    if (ct) p.set('city', ct)
    else p.delete('city')
    if (focusKeep?.trim()) p.set('focus', focusKeep.trim())
    setParams(p, { replace: true })
    localStorage.setItem(
      MAP_PREFS_KEY,
      JSON.stringify({
        q: q.trim(),
        region: regionFilter,
        sort: sortBy,
        city: ct,
      })
    )
  }, [q, regionFilter, sortBy, mapCity, setParams])

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
        markGeolocationKnown()
        tryClearMapLoadingAfterFirstCoords()
        setUserPos(pos)
        lastReportedUserPosRef.current = pos
        /** مركز الخريطة على المستخدم مرة واحدة فقط عند التحميل — لا يتبع الـ watch */
        if (!hasAutoCenteredOnGpsRef.current) {
          hasAutoCenteredOnGpsRef.current = true
          setMapCenter(pos)
          setMapZoom(USER_LOCATION_ZOOM)
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
          markGeolocationKnown()
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

  const centerOnUser = useCallback(() => {
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
        markGeolocationKnown()
        setUserPos(pos)
        setMapCenter(pos)
        setMapZoom(USER_LOCATION_ZOOM)
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
  }, [lang])

  const businessesSafe = useMemo(() => {
    const a = Array.isArray(businesses) ? businesses : []
    const b = Array.isArray(googlePlaces) ? googlePlaces : []
    const merged = dedupeBusinessesForDisplay([...a, ...b])
    return filterMapDisplayBusinesses(merged)
  }, [businesses, googlePlaces])

  /** من المحادثة: `/map?focus=<businessId>` — تمركز الخريطة وفتح البطاقة عند توفر البيانات */
  useEffect(() => {
    const sp = new URLSearchParams(location.search)
    const fid = sp.get('focus')?.trim()
    if (!fid) return
    const b = businessesSafe.find((x) => String(x.id) === fid)
    if (!b || !isValidLatLng(b.latitude, b.longitude)) return
    setSelected(b)
    setMapCenter([Number(b.latitude), Number(b.longitude)])
    setMapZoom(15)
    const next = new URLSearchParams(location.search)
    next.delete('focus')
    setParams(next, { replace: true })
  }, [businessesSafe, location.search, setParams])

  const filtered = useMemo(() => {
    const qq = q.trim()
    const cityTrim = mapCity.trim()
    let rows = businessesSafe.filter((b) => {
      const inText =
        !qq ||
        (b.name_ar ?? '').includes(qq) ||
        (b.city ?? '').includes(qq) ||
        (b.region && b.region.includes(qq)) ||
        (b.category_label && b.category_label.includes(qq))
      const inRegion = regionFilter === 'all' || isEasternProvinceBusiness(b)
      const blobCity = [b.city, b.name_ar, b.name_en].filter(Boolean).join(' ')
      const inCity =
        !cityTrim ||
        (blobCity.includes(cityTrim) || blobCity.toLowerCase().includes(cityTrim.toLowerCase()))
      return inText && inRegion && inCity
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
    } else if (sortBy === 'nearest') {
      if (Array.isArray(userPos) && userPos.length >= 2) {
        rows = [...rows].sort(
          (a, b) =>
            haversineKm(userPos[0], userPos[1], a.latitude!, a.longitude!) -
            haversineKm(userPos[0], userPos[1], b.latitude!, b.longitude!)
        )
      } else {
        rows = [...rows].sort(
          (a, b) =>
            Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0) ||
            Number(b.total_reviews ?? 0) - Number(a.total_reviews ?? 0)
        )
      }
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
  }, [businessesSafe, q, mapCity, regionFilter, sortBy, userPos])

  /** صفوف جاهزة للـ Marker — إحداثيات رقمية صالحة فقط */
  const ratingPinFmt = useMemo(
    () =>
      new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [lang]
  )

  /** أعلى 3 صالونات بالتقييم ضمن النتائج المفلترة — تمييز على الخريطة */
  const topSalonIds = useMemo(() => {
    const withCoords = filtered.filter((b) => b.id != null && isValidLatLng(b.latitude, b.longitude))
    const sorted = [...withCoords].sort(
      (a, b) =>
        Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0) ||
        Number(b.total_reviews ?? 0) - Number(a.total_reviews ?? 0)
    )
    return new Set(sorted.slice(0, 3).map((b) => String(b.id)))
  }, [filtered])

  const mapMarkers = useMemo(() => {
    return filtered
      .filter((b) => b.id != null && isValidLatLng(b.latitude, b.longitude))
      .map((b) => {
        const r = Number(b.average_rating ?? 0)
        const id = String(b.id)
        return {
          id,
          b,
          position: [Number(b.latitude), Number(b.longitude)] as [number, number],
          rating: r,
          pinRatingLabel: ratingPinFmt.format(r),
          tier: topSalonIds.has(id) ? ('top' as const) : ('default' as const),
        }
      })
  }, [filtered, ratingPinFmt, topSalonIds])

  const activeFiltersCount = useMemo(() => {
    let n = 0
    if (q.trim()) n += 1
    if (mapCity.trim()) n += 1
    if (regionFilter !== 'all') n += 1
    if (sortBy !== 'rating') n += 1
    return n
  }, [q, mapCity, regionFilter, sortBy])

  const handleSortChange = (v: string) => {
    setSortBy(v as 'rating' | 'booked' | 'nearest' | 'name' | 'newest')
  }

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

  /** توقيع ثابت للـ memo — لا يعتمد على مرجع المصفوفة فقط */
  const mapMarkersSignature = useMemo(
    () =>
      mapMarkers
        .map((m) => {
          const la = m.position[0]
          const ln = m.position[1]
          if (!Number.isFinite(la) || !Number.isFinite(ln)) return ''
          const r = typeof m.rating === 'number' && Number.isFinite(m.rating) ? m.rating : 0
          return `${m.id}:${la.toFixed(5)},${ln.toFixed(5)}:${m.pinRatingLabel}:${r.toFixed(2)}:${m.tier ?? 'default'}`
        })
        .filter(Boolean)
        .join('|'),
    [mapMarkers]
  )

  return (
    <div
      className="rosera-map-page fixed inset-0 z-10 flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-white dark:bg-rosera-dark"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <button
        type="button"
        onClick={() => nav('/home')}
        className="absolute start-3 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-[600] inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-[#374151] shadow-md ring-1 ring-[#E5E7EB] transition-all duration-200 hover:bg-[#FDF2F8] active:scale-95 dark:bg-card dark:text-white dark:ring-border"
        style={{ direction: lang === 'ar' ? 'rtl' : 'ltr' }}
      >
        <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
        {lang === 'ar' ? 'الرئيسية' : 'Home'}
      </button>
      <div
        className="absolute start-0 end-0 top-0 z-[500] space-y-1.5 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="relative mx-auto max-w-lg">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-rosera-gray" />
          <Input
            ref={searchInputRef}
            className="h-11 rounded-2xl border-0 bg-white/95 ps-10 shadow-md ring-1 ring-black/5 dark:bg-card dark:ring-border"
            placeholder={sortBy === 'name' ? t('map.searchByNamePh') : t('map.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mx-auto flex max-w-lg flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={regionFilter === 'eastern' ? 'default' : 'secondary'}
              onClick={() => setRegionFilter(regionFilter === 'eastern' ? 'all' : 'eastern')}
            >
              {regionFilter === 'eastern' ? t('map.regionEasternOn') : t('map.regionEastern')}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gap-1 text-xs" onClick={resetMapFilters}>
              {t('common.reset')}
              {activeFiltersCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F9A8C9] px-1 text-[10px] font-extrabold text-[#374151]">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1 text-xs"
              disabled={mapLoading}
              onClick={() => void fetchBusinesses({ showToast: true, busyIndicator: true })}
              title={lang === 'ar' ? 'إعادة جلب المنشآت من السيرفر' : 'Reload places from server'}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${mapLoading ? 'animate-spin' : ''}`} aria-hidden />
              {mapLoading ? t('map.refreshing') : t('map.refresh')}
            </Button>
          </div>
          <SortPills
            value={sortBy}
            onChange={handleSortChange}
            nowrap
            options={[
              { value: 'rating', label: t('city.sort.rating') },
              { value: 'booked', label: t('city.sort.booked') },
              { value: 'nearest', label: t('search.sortNearest') },
              { value: 'name', label: t('map.sortByName') },
              { value: 'newest', label: t('map.sortNewest') },
            ]}
            className="scrollbar-hide overflow-x-auto pb-0.5"
          />
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
          markers={mapMarkers}
          markersSignature={mapMarkersSignature}
          highlightMarkerId={selected?.id ?? null}
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
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-[120] flex items-center justify-center bg-white/45 transition-opacity duration-500 ease-out dark:bg-rosera-dark/45',
            mapLoading ? 'opacity-100' : 'opacity-0'
          )}
          aria-busy={mapLoading}
          aria-hidden={!mapLoading}
        >
          <div className="flex max-w-[min(100%,18rem)] flex-col items-center gap-4 rounded-2xl border border-primary/25 bg-white/95 px-8 py-6 text-center shadow-soft backdrop-blur-sm animate-premium-in dark:border-border dark:bg-card/95">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/25 [animation-duration:1.8s]" aria-hidden />
              <RefreshCw className="relative h-8 w-8 animate-spin text-[#BE185D]" aria-hidden />
            </div>
            <p className="text-sm font-semibold leading-snug text-rosera-text">{t('map.loadingOverlay')}</p>
          </div>
        </div>
      </div>

      <Button
        type="button"
        size="icon"
        variant="default"
        className="absolute right-4 z-[500] h-12 w-12 shadow-lg"
        style={{ bottom: MAP_BOTTOM_SAFE }}
        onClick={() => centerOnUser()}
        aria-label={lang === 'ar' ? 'توسيط الخريطة على موقعك' : 'Center map on your location'}
      >
        <Crosshair className="h-6 w-6 text-[#374151]" />
      </Button>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute left-4 z-[500] shadow-md"
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
              {topSalonIds.has(String(selected.id)) && (
                <span className="mt-1 inline-flex items-center rounded-full border border-amber-400/60 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  {t('map.topSalonBadge')}
                </span>
              )}
              <div
                dir="ltr"
                style={{ unicodeBidi: 'isolate' }}
                className="mt-1 flex items-center justify-start gap-1 text-[#BE185D]"
              >
                <Star className="h-4 w-4 shrink-0 fill-[#BE185D] text-[#BE185D]" aria-hidden />
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
                  variant="default"
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

    </div>
  )
}
