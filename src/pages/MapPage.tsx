import { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback, lazy, Suspense } from 'react'
import { MapErrorBoundary, MapFallback } from '@/components/map/MapErrorBoundary'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Search, Crosshair, ChevronLeft, RefreshCw, Star } from 'lucide-react'
import { supabase, type Business } from '@/lib/supabase'
import { haversineKm, cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SortPills } from '@/components/ui/sort-pills'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { openNativeMapsDirections } from '@/lib/openNativeMapsDirections'
import { fetchGooglePlacesBeautySalons } from '@/lib/fetchGooglePlacesBeauty'
import { dedupeBusinessesForDisplay, filterFemaleBeautyBusinesses } from '@/lib/roseraBusinessFilters'
import { GOOGLE_MAPS_API_KEY_EMBEDDED } from '@/config/googleMapsApiKey'
import { tr } from '@/lib/i18n'
import { hasGeolocationKnown, markGeolocationKnown } from '@/lib/geoSession'
import { MapRosySuggestions } from '@/components/map/MapRosySuggestions'
import {
  getMapSuggestions,
  getSuggestionById,
  parseRosyUrlParam,
  businessValueScore,
  sliceHighlightIdsFromOrdered,
  ROSEY_MAP_SESSION_KEY,
  readMapChatHintsFromSession,
  type MapSuggestion,
  type MapSuggestionId,
} from '@/lib/mapSuggestions'
import { buildRoseyScoringContext } from '@/lib/mapRecommendationScoring'
import { createMapMarkerStore } from '@/lib/mapMarkerStore'
import { captureProductEvent, trackCategoryFilterSelected } from '@/lib/posthog'
import {
  businessMatchesSearchCategory,
  resolveSearchCategoryFilter,
} from '@/lib/searchCategoryFilter'
import { useAuth } from '@/contexts/AuthContext'
import { fetchAiUserProfile, fetchActiveSubscriptionPlansForSalonIds, type AiUserProfile } from '@/lib/aiRanking'
import { fetchBestActiveOffersByBusinessIds, type SalonActiveOffer } from '@/lib/offers'
import { fetchActiveSalonFeaturedAdSalonIds } from '@/lib/salonAds'
import { boundsToLatLngBox, fetchSalonsInBounds, type LatLngBoundsBox } from '@/lib/fetchSalonsInBounds'
import { buildMapMarkersSignature } from '@/lib/mapMarkers'
import { MapFilterDrawer } from '@/components/map/MapFilterDrawer'
import {
  MAP_FILTER_DRAWER_CATEGORY_IDS,
  MAP_FILTER_DRAWER_CONFIGS,
  type MapFilterDrawerCategoryId,
} from '@/lib/mapFilterDrawerConfig'
import {
  applyMapDrawerFilters,
  MAP_DRAWER_CATEGORY_TO_SORT,
  type MapDrawerSelections,
} from '@/lib/applyMapDrawerFilters'
import type { SalonSubscriptionPlan } from '@/lib/salonSubscriptionPlans'
import {
  compareBusinessesAfterPersonalizedScore,
  mapSmartCombinedScore,
  mergeSubscriptionPlan,
  parsePreferredServiceParam,
  type PersonalizedRankingSignals,
} from '@/lib/personalizedSalonRanking'

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
/** زوم بعد «إعادة الضبط» عند التمركز على المستخدم */
const RESET_MAP_ZOOM = 14
const MAP_PREFS_KEY = 'rosera:map:prefs'
/** sonner id — يُزال تلقائياً عند نجاح الجلب */
const MAP_DATA_ERROR_TOAST_ID = 'rosera-map-data-error'
/** أقل مسافة (م) لتحديث نقطة المستخدم من watchPosition — يقلّل وميض الـ Blue Dot */
const GEO_WATCH_MIN_MOVE_METERS = 10
/** حد أقصى للدبابيس المعروضة — تجميع MarkerClusterer + استقرار الذاكرة */
const MAX_MAP_MARKERS = 60

type MapSortKey = 'rating' | 'booked' | 'nearest' | 'name' | 'newest' | 'value' | 'smart'

const MapPageMap = lazy(() => import('@/components/map/MapPageMap'))

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
  const { user } = useAuth()
  const nav = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const mapMarkerStoreRef = useRef<ReturnType<typeof createMapMarkerStore> | null>(null)
  if (mapMarkerStoreRef.current === null) mapMarkerStoreRef.current = createMapMarkerStore()
  const mapMarkerStore = mapMarkerStoreRef.current
  const storedPrefs = (() => {
    try {
      return JSON.parse(localStorage.getItem(MAP_PREFS_KEY) || '{}') as {
        q?: string
        region?: 'all' | 'eastern'
        sort?: MapSortKey
        city?: string
        categoryLabel?: string
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
    urlSortRaw === 'newest' ||
    urlSortRaw === 'value' ||
    urlSortRaw === 'smart'
      ? urlSortRaw
      : null
  const initialSort =
    urlSort ?? (hasGeolocationKnown() ? 'nearest' : (storedPrefs.sort ?? 'rating'))
  const initialCity = params.get('city') ?? storedPrefs.city ?? ''
  const initialCategoryLabel = params.get('categoryLabel') ?? storedPrefs.categoryLabel ?? ''

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
  const [sortBy, setSortBy] = useState<MapSortKey>(initialSort)
  const [activeSuggestionId, setActiveSuggestionId] = useState<MapSuggestionId | null>(null)
  /** يُحدَّث كل دقيقة لإعادة ترتيب شرائح روزي حسب الوقت — دون ربط بتحريك الخريطة */
  const [rosyTimeTick, setRosyTimeTick] = useState(0)
  const [mapCity, setMapCity] = useState(initialCity)
  const [mapCategoryLabel, setMapCategoryLabel] = useState(initialCategoryLabel)
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
  const mapShellRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const userPosRef = useRef<[number, number] | null>(null)
  const lastRefreshRef = useRef(0)
  const refreshInFlightRef = useRef(false)
  const viewportFetchAbortRef = useRef<AbortController | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [mapShellVisible, setMapShellVisible] = useState(false)
  /** تطبيق `?rosy=` أو جلسة التنقل من روزي — مرة واحدة */
  const rosyLandingHandledRef = useRef(false)
  /** تجاهل أول قيمة (تحميل أولي) — تتبع تغييرات التصنيف لاحقاً (رابط، إعادة ضبط، إلخ). */
  const mapCategoryLabelPrevRef = useRef<string | null>(null)
  const [mapAiProfile, setMapAiProfile] = useState<AiUserProfile | undefined>(undefined)
  const [mapPlanMap, setMapPlanMap] = useState<Map<string, SalonSubscriptionPlan>>(new Map())
  const [mapOfferMap, setMapOfferMap] = useState<Map<string, SalonActiveOffer>>(new Map())
  const [mapFeaturedAdIds, setMapFeaturedAdIds] = useState<Set<string>>(new Set())
  const [mapFilterDrawerCategory, setMapFilterDrawerCategory] =
    useState<MapFilterDrawerCategoryId | null>(null)
  const [mapFilterDrawerDraft, setMapFilterDrawerDraft] = useState<string[]>([])
  const [mapDrawerSelections, setMapDrawerSelections] = useState<MapDrawerSelections>({})

  useEffect(() => {
    captureProductEvent('map_open', {})
  }, [])

  useEffect(() => {
    userPosRef.current = userPos
  }, [userPos])

  useEffect(() => {
    if (!user?.id) {
      setMapAiProfile(undefined)
      return
    }
    let c = true
    void fetchAiUserProfile(user.id).then((p) => {
      if (c) setMapAiProfile(p)
    })
    return () => {
      c = false
    }
  }, [user?.id])

  useEffect(() => {
    const cur = mapCategoryLabel.trim()
    if (mapCategoryLabelPrevRef.current === null) {
      mapCategoryLabelPrevRef.current = cur
      return
    }
    if (mapCategoryLabelPrevRef.current === cur) return
    mapCategoryLabelPrevRef.current = cur
    const res = resolveSearchCategoryFilter(cur)
    const key = res.ok ? res.canonical : cur === '' ? 'all' : 'other'
    trackCategoryFilterSelected('map_session', key)
  }, [mapCategoryLabel])

  /** تحميل مكوّن الخريطة عند ظهور الحاوية (تقسيم الحزمة + تقليل عمل غير المرئي) */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setMapShellVisible(true)
      return
    }
    const el = mapShellRef.current
    if (!el) {
      setMapShellVisible(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setMapShellVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.01, rootMargin: '80px' }
    )
    io.observe(el)
    const safety = window.setTimeout(() => setMapShellVisible(true), 2500)
    return () => {
      clearTimeout(safety)
      io.disconnect()
    }
  }, [])

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

  const resetMap = useCallback(() => {
    setQ('')
    setMapCity('')
    setMapCategoryLabel('')
    setRegionFilter('eastern')
    setSortBy('rating')
    setActiveSuggestionId(null)
    setSelected(null)
    setMapDrawerSelections({})
    setMapFilterDrawerCategory(null)
    setMapFilterDrawerDraft([])
    localStorage.removeItem(MAP_PREFS_KEY)
    setParams(new URLSearchParams(), { replace: true })

    const pos = userPosRef.current
    if (pos && Number.isFinite(pos[0]) && Number.isFinite(pos[1])) {
      setMapCenter([pos[0], pos[1]])
      setMapZoom(RESET_MAP_ZOOM)
    } else {
      setMapCenter(DEFAULT_CENTER)
      setMapZoom(DEFAULT_ZOOM)
    }
    toast.success(t('map.resetDoneCheck'))
  }, [setParams, t])

  const openMapFilterDrawer = useCallback((id: MapFilterDrawerCategoryId) => {
    setMapFilterDrawerCategory(id)
    setMapFilterDrawerDraft([...(mapDrawerSelections[id] ?? [])])
  }, [mapDrawerSelections])

  const toggleMapFilterDraftOption = useCallback((v: string) => {
    setMapFilterDrawerDraft((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    )
  }, [])

  const closeMapFilterDrawer = useCallback(() => {
    setMapFilterDrawerCategory(null)
    setMapFilterDrawerDraft([])
  }, [])

  const clearMapFilterCategory = useCallback((id: string) => {
    setMapFilterDrawerDraft([])
    setMapDrawerSelections((prev) => {
      const next = { ...prev }
      delete next[id as MapFilterDrawerCategoryId]
      return next
    })
  }, [])

  const handleMapFilterApply = useCallback(
    (opts: string[]) => {
      const cat = mapFilterDrawerCategory
      if (!cat) return
      const wantsDist = opts.some((o) => o.startsWith('dist_'))
      if (cat === 'nearest' && wantsDist && !userPosRef.current) {
        toast.error(tr(lang, 'map.rosyNeedLocation'))
      }
      const sortKey = MAP_DRAWER_CATEGORY_TO_SORT[cat]
      if (sortKey) setSortBy(sortKey)
      setMapDrawerSelections((prev) => {
        const next = { ...prev }
        if (opts.length === 0) {
          delete next[cat]
          return next
        }
        next[cat] = opts
        return next
      })
      if ((cat === 'most_booked' || cat === 'quick_book') && opts.length > 0) {
        toast.message(tr(lang, 'map.drawerSoftFilterHint'), { duration: 4000 })
      }
      setActiveSuggestionId(null)
      closeMapFilterDrawer()
    },
    [mapFilterDrawerCategory, lang, closeMapFilterDrawer],
  )

  const handleViewportBoundsIdle = useCallback(async (box: LatLngBoundsBox) => {
    viewportFetchAbortRef.current?.abort()
    const ac = new AbortController()
    viewportFetchAbortRef.current = ac
    try {
      const rows = await fetchSalonsInBounds(box, { signal: ac.signal })
      const normalized = rows.map(normalizeBusinessCoords)
      setBusinesses((prev) => {
        const m = new Map<string, Business>()
        for (const b of prev) {
          if (b.id != null) m.set(String(b.id), b)
        }
        for (const b of normalized) {
          if (b.id != null) m.set(String(b.id), b)
        }
        return Array.from(m.values())
      })
      mapFetchBusyCount.current = 0
      setMapLoading(false)
      fetchFailureNotified.current = false
      toast.dismiss(MAP_DATA_ERROR_TOAST_ID)
    } catch (e: unknown) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError')
      if (aborted) return
      mapFetchBusyCount.current = 0
      setMapLoading(false)
      if (!fetchFailureNotified.current) {
        fetchFailureNotified.current = true
        toast.error(tr(lang, 'map.dataLoadError'), { id: MAP_DATA_ERROR_TOAST_ID })
      }
    }
  }, [lang])

  useEffect(() => {
    return () => {
      viewportFetchAbortRef.current?.abort()
    }
  }, [])

  /** Google Places تكميل — دون جلب جدول businesses كاملاً عند التحميل */
  useEffect(() => {
    const gKey = GOOGLE_MAPS_API_KEY_EMBEDDED.trim()
    if (!gKey) return
    let c = false
    void fetchGooglePlacesBeautySalons(gKey)
      .then((places) => {
        if (!c) setGooglePlaces(places.map(normalizeBusinessCoords))
      })
      .catch(() => {
        if (!c) setGooglePlaces([])
      })
    return () => {
      c = true
    }
  }, [])

  const refreshMap = useCallback(async () => {
    const now = Date.now()
    if (refreshInFlightRef.current || now - lastRefreshRef.current < 500) return
    lastRefreshRef.current = now
    refreshInFlightRef.current = true
    setIsRefreshing(true)
    try {
      const map = mapInstanceRef.current
      if (!map) return
      const bounds = map.getBounds()
      if (!bounds) return
      viewportFetchAbortRef.current?.abort()
      const ac = new AbortController()
      viewportFetchAbortRef.current = ac
      const rows = await fetchSalonsInBounds(boundsToLatLngBox(bounds), { signal: ac.signal })
      const normalized = rows.map(normalizeBusinessCoords)
      setBusinesses((prev) => {
        const m = new Map<string, Business>()
        for (const b of prev) {
          if (b.id != null) m.set(String(b.id), b)
        }
        for (const b of normalized) {
          if (b.id != null) m.set(String(b.id), b)
        }
        return Array.from(m.values())
      })
      toast.success(tr(lang, 'map.refreshed', { count: normalized.length }))
    } catch (e: unknown) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError')
      if (!aborted) toast.error(tr(lang, 'map.refreshFailed'))
    } finally {
      refreshInFlightRef.current = false
      setIsRefreshing(false)
    }
  }, [lang])

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

  const refetchMapDataSoft = useCallback(() => {
    const map = mapInstanceRef.current
    const b = map?.getBounds()
    if (b) {
      void handleViewportBoundsIdle(boundsToLatLngBox(b))
    } else {
      void fetchBusinesses({ busyIndicator: false, suppressErrorToast: true })
    }
  }, [fetchBusinesses, handleViewportBoundsIdle])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        refetchMapDataSoft()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refetchMapDataSoft])

  const focusRefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    const onFocus = () => {
      if (focusRefetchTimer.current) clearTimeout(focusRefetchTimer.current)
      focusRefetchTimer.current = setTimeout(() => {
        refetchMapDataSoft()
      }, 1500)
    }
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      if (focusRefetchTimer.current) clearTimeout(focusRefetchTimer.current)
    }
  }, [refetchMapDataSoft])

  useEffect(() => {
    const id = window.setInterval(() => setRosyTimeTick((x) => x + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (sortBy === 'name') {
      const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 150)
      return () => window.clearTimeout(focusTimer)
    }
  }, [sortBy])

  useEffect(() => {
    if (sortBy !== 'nearest' && sortBy !== 'smart') return
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
    if (sp.has('categoryLabel')) {
      const cl = sp.get('categoryLabel') ?? ''
      setMapCategoryLabel((prev) => (prev === cl ? prev : cl))
    }
  }, [location.search])

  useEffect(() => {
    if (rosyLandingHandledRef.current) return

    const urlRaw = params.get('rosy')
    const urlRid = parseRosyUrlParam(urlRaw)

    let rid: MapSuggestionId | null = urlRid
    let sessionPending: string | null = null

    if (!rid) {
      try {
        const raw = sessionStorage.getItem(ROSEY_MAP_SESSION_KEY)
        if (raw) {
          sessionPending = raw
          rid = (parseRosyUrlParam(raw) ?? (raw as MapSuggestionId)) as MapSuggestionId
        }
      } catch {
        /* ignore */
      }
    }

    if (!rid) return

    const sug = getSuggestionById(rid)
    if (!sug) {
      rosyLandingHandledRef.current = true
      if (sessionPending) {
        try {
          sessionStorage.removeItem(ROSEY_MAP_SESSION_KEY)
        } catch {
          /* ignore */
        }
      }
      if (urlRaw) {
        const next = new URLSearchParams(params)
        next.delete('rosy')
        setParams(next, { replace: true })
      }
      return
    }

    if (sug.requiresLocation && !userPos) return

    rosyLandingHandledRef.current = true
    if (sessionPending) {
      try {
        sessionStorage.removeItem(ROSEY_MAP_SESSION_KEY)
      } catch {
        /* ignore */
      }
    }
    setSortBy(sug.sortBy)
    if (sug.searchQuery !== undefined) setQ(sug.searchQuery)
    setActiveSuggestionId(sug.id)
    if (urlRaw) {
      const next = new URLSearchParams(params)
      next.delete('rosy')
      setParams(next, { replace: true })
    }
  }, [params, userPos, setParams])

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
    const cLab = mapCategoryLabel.trim()
    if (cLab) p.set('categoryLabel', cLab)
    else p.delete('categoryLabel')
    if (focusKeep?.trim()) p.set('focus', focusKeep.trim())
    setParams(p, { replace: true })
    localStorage.setItem(
      MAP_PREFS_KEY,
      JSON.stringify({
        q: q.trim(),
        region: regionFilter,
        sort: sortBy,
        city: ct,
        categoryLabel: cLab,
      })
    )
  }, [q, regionFilter, sortBy, mapCity, mapCategoryLabel, setParams])

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
    return filterFemaleBeautyBusinesses(merged)
  }, [businesses, googlePlaces])

  useEffect(() => {
    const ids = businessesSafe.map((b) => b.id).filter(Boolean)
    if (!ids.length) {
      setMapPlanMap(new Map())
      setMapOfferMap(new Map())
      setMapFeaturedAdIds(new Set())
      return
    }
    let c = true
    void Promise.all([
      fetchActiveSubscriptionPlansForSalonIds(ids),
      fetchBestActiveOffersByBusinessIds(ids),
      fetchActiveSalonFeaturedAdSalonIds(ids),
    ]).then(([plans, offers, featured]) => {
      if (c) {
        setMapPlanMap(plans)
        setMapOfferMap(offers)
        setMapFeaturedAdIds(featured)
      }
    })
    return () => {
      c = false
    }
  }, [businessesSafe])

  const mapCatResolved = useMemo(() => resolveSearchCategoryFilter(mapCategoryLabel), [mapCategoryLabel])

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

  const mapParamSig = params.toString()

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

    if (mapCatResolved.ok) {
      rows = rows.filter((b) => businessMatchesSearchCategory(b, mapCatResolved.canonical))
    }

    rows = applyMapDrawerFilters(rows, mapDrawerSelections, userPos)

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
    } else if (sortBy === 'value') {
      rows = [...rows].sort(
        (a, b) =>
          businessValueScore(b) - businessValueScore(a) ||
          Number(b.average_rating ?? 0) - Number(a.average_rating ?? 0)
      )
    } else if (sortBy === 'smart') {
      const chatKeywords = readMapChatHintsFromSession()
      const ctx = buildRoseyScoringContext({
        userPos: Array.isArray(userPos) && userPos.length >= 2 ? userPos : null,
        candidates: rows,
        now: new Date(),
        searchQuery: q.trim(),
        chatKeywords,
      })
      const urlParams = new URLSearchParams(mapParamSig)
      const overlaySignals: PersonalizedRankingSignals = {
        mapOverlayMode: true,
        categoryCanonical: mapCatResolved.ok ? mapCatResolved.canonical : null,
        preferredServiceType: parsePreferredServiceParam(urlParams.get('service')),
        districtHint: urlParams.get('district')?.trim() || null,
      }
      const toRankable = (b: Business) => ({
        id: b.id,
        average_rating: b.average_rating,
        total_reviews: b.total_reviews,
        category: b.category,
        category_label: b.category_label,
        city: b.city,
        price_range: b.price_range,
        subscription_plan: mergeSubscriptionPlan(b, mapPlanMap.get(b.id)),
        is_featured: b.is_featured,
        has_active_featured_ad: mapFeaturedAdIds.has(b.id),
        activeOffer: mapOfferMap.get(b.id) ?? null,
      })
      const scored = rows.map((b) => {
        const rk = toRankable(b)
        return {
          b,
          rk,
          score: mapSmartCombinedScore(b, rk, ctx, overlaySignals, mapAiProfile).total,
        }
      })
      scored.sort((x, y) => {
        const d = y.score - x.score
        if (Math.abs(d) > 1e-9) return d
        return compareBusinessesAfterPersonalizedScore(x.b, y.b, x.rk, y.rk)
      })
      rows = scored.map((s) => s.b)
    }
    return rows
  }, [
    businessesSafe,
    q,
    mapCity,
    mapCatResolved,
    mapDrawerSelections,
    regionFilter,
    sortBy,
    userPos,
    mapParamSig,
    mapAiProfile,
    mapPlanMap,
    mapOfferMap,
    mapFeaturedAdIds,
  ])

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

  /** تمييز خفيف لاقتراح روزي — نفس ترتيب القائمة المفلترة، بدون إعادة فرز عند تحريك الخريطة */
  const suggestionHighlightIds = useMemo(() => {
    if (!activeSuggestionId) return new Set<string>()
    return new Set(sliceHighlightIdsFromOrdered(filtered, 8))
  }, [filtered, activeSuggestionId])

  const mapMarkers = useMemo(() => {
    return filtered
      .filter((b) => b.id != null && isValidLatLng(b.latitude, b.longitude))
      .map((b) => {
        const raw = b.average_rating
        const r = raw == null ? NaN : Number(raw)
        const hasRating = Number.isFinite(r) && r > 0
        const pinRatingLabel = hasRating ? ratingPinFmt.format(r) : '—'
        const id = String(b.id)
        const isTop = topSalonIds.has(id)
        const priority =
          isTop ||
          Boolean(b.is_featured) ||
          b.subscription_plan === 'premium'
        const suggestionBoost = Boolean(activeSuggestionId && suggestionHighlightIds.has(id))
        return {
          id,
          b,
          position: [Number(b.latitude), Number(b.longitude)] as [number, number],
          rating: hasRating ? r : 0,
          pinRatingLabel,
          tier: isTop ? ('top' as const) : ('default' as const),
          priority,
          suggestionBoost,
        }
      })
  }, [filtered, ratingPinFmt, topSalonIds, activeSuggestionId, suggestionHighlightIds])

  const mapMarkersLimited = useMemo(() => {
    const list = [...mapMarkers]
    list.sort((a, b) => {
      const pr = (b.priority ? 1 : 0) - (a.priority ? 1 : 0)
      if (pr !== 0) return pr
      const tierOrder = (b.tier === 'top' ? 1 : 0) - (a.tier === 'top' ? 1 : 0)
      if (tierOrder !== 0) return tierOrder
      return b.rating - a.rating
    })
    return list.slice(0, MAX_MAP_MARKERS)
  }, [mapMarkers])

  const activeFiltersCount = useMemo(() => {
    let n = 0
    if (q.trim()) n += 1
    if (mapCity.trim()) n += 1
    if (resolveSearchCategoryFilter(mapCategoryLabel).ok) n += 1
    if (regionFilter !== 'all') n += 1
    if (sortBy !== 'rating') n += 1
    if (activeSuggestionId) n += 1
    for (const arr of Object.values(mapDrawerSelections)) {
      if (Array.isArray(arr) && arr.length > 0) n += 1
    }
    return n
  }, [q, mapCity, mapCategoryLabel, regionFilter, sortBy, activeSuggestionId, mapDrawerSelections])

  const rosySuggestionsNow = useMemo(() => {
    void rosyTimeTick
    return new Date()
  }, [rosyTimeTick])
  const rosySuggestions = useMemo(
    () =>
      getMapSuggestions({
        hasUserLocation: Boolean(userPos && userPos.length >= 2),
        now: rosySuggestionsNow,
        searchQuery: q.trim(),
        chatKeywords: readMapChatHintsFromSession(),
      }),
    [userPos, q, rosySuggestionsNow]
  )

  const handleRosySelect = useCallback(
    (s: MapSuggestion) => {
      if (activeSuggestionId === s.id) {
        setActiveSuggestionId(null)
        return
      }
      if (s.requiresLocation && !userPos) {
        toast.error(tr(lang, 'map.rosyNeedLocation'))
        return
      }
      setSortBy(s.sortBy)
      if (s.searchQuery !== undefined) setQ(s.searchQuery)
      setActiveSuggestionId(s.id)
    },
    [activeSuggestionId, userPos, lang]
  )

  const handleSortChange = (v: string) => {
    setSortBy(v as MapSortKey)
    setActiveSuggestionId(null)
  }

  /** أرقام فقط في deps — لا يُعاد إنشاء مصفوفة جديدة إلا عند تغيّر الإحداثيات فعلياً */
  const safeMapCenter: [number, number] = useMemo(() => {
    if (!Array.isArray(mapCenter) || mapCenter.length < 2) return DEFAULT_CENTER
    const [a, b] = mapCenter
    if (isValidLatLng(a, b)) return [Number(a), Number(b)]
    return DEFAULT_CENTER
  }, [mapCenter])

  const handleMarkerSelect = useCallback((b: Business, position: [number, number]) => {
    setSelected(b)
    setMapCenter(position)
    setMapZoom(13)
  }, [])

  const mapMarkersSignature = useMemo(() => buildMapMarkersSignature(mapMarkersLimited), [mapMarkersLimited])

  useLayoutEffect(() => {
    mapMarkerStore.setMarkers(mapMarkersLimited, mapMarkersSignature)
  }, [mapMarkerStore, mapMarkersLimited, mapMarkersSignature])

  const mapCenterValid = isValidLatLng(safeMapCenter[0], safeMapCenter[1])

  if (!mapCenterValid) {
    return (
      <div
        className="rosera-map-page fixed inset-0 z-raised flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-background"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <button
          type="button"
          onClick={() => nav('/home')}
          className="absolute start-3 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-map-elevated inline-flex items-center gap-2 rounded-3xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-floating backdrop-blur-md ring-1 ring-border/50"
        >
          <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
          {lang === 'ar' ? 'الرئيسية' : 'Home'}
        </button>
        <MapFallback />
      </div>
    )
  }

  return (
    <div
      className="rosera-map-page fixed inset-0 z-raised flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden overscroll-none bg-background"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <button
        type="button"
        onClick={() => nav('/home')}
        className="absolute start-3 top-[calc(env(safe-area-inset-top,0px)+4.25rem)] z-map-elevated inline-flex items-center gap-2 rounded-3xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-floating backdrop-blur-md ring-1 ring-border/50 transition-all duration-200 hover:border-primary/25 hover:shadow-floating active:scale-[0.98]"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
        {lang === 'ar' ? 'الرئيسية' : 'Home'}
      </button>
      <div
        className="absolute start-0 end-0 top-0 z-map space-y-1.5 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top,0px))]"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="relative mx-auto max-w-lg">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-rosera-gray" />
          <Input
            ref={searchInputRef}
            className="h-11 rounded-3xl border border-border bg-card ps-10 shadow-elevated backdrop-blur-md ring-1 ring-border/50"
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
            <Button type="button" size="sm" variant="ghost" className="gap-1 text-xs" onClick={resetMap}>
              {t('common.reset')}
              {activeFiltersCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/35 px-1 text-[10px] font-extrabold text-foreground">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="map-control-btn h-9 w-9 shrink-0 touch-manipulation"
              disabled={isRefreshing}
              onClick={() => void refreshMap()}
              title={lang === 'ar' ? 'تحديث المنشآت في نطاق الخريطة' : 'Refresh places in map view'}
              aria-label={isRefreshing ? t('map.refreshing') : t('map.refresh')}
            >
              <RefreshCw
                className={`h-4 w-4 transition-transform duration-700 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden
              />
            </Button>
          </div>
          <SortPills
            variant="mapLuxury"
            value={sortBy}
            onChange={handleSortChange}
            nowrap
            ariaLabel={t('a11y.sortResults')}
            options={[
              { value: 'rating', label: t('city.sort.rating') },
              { value: 'booked', label: t('city.sort.booked') },
              { value: 'nearest', label: t('search.sortNearest') },
              { value: 'smart', label: t('map.sortSmart') },
              { value: 'value', label: t('map.sortValue') },
              { value: 'name', label: t('map.sortByName') },
              { value: 'newest', label: t('map.sortNewest') },
            ]}
            className="scrollbar-hide overflow-x-auto pb-0.5"
          />
          <div className="scrollbar-hide -mx-0.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {MAP_FILTER_DRAWER_CATEGORY_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => openMapFilterDrawer(id)}
                className={cn(
                  'filter-chip inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold shadow-sm ring-offset-background transition-all',
                  mapDrawerSelections[id]?.length
                    ? 'ring-2 ring-primary ring-offset-1'
                    : 'hover:border-primary/25',
                )}
              >
                <span className="font-cairo text-foreground">{MAP_FILTER_DRAWER_CONFIGS[id].title}</span>
                {mapDrawerSelections[id]?.length ? (
                  <span className="me-1 inline-block h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
                ) : null}
              </button>
            ))}
          </div>
          {mapCatResolved.ok ? (
            <p className="px-0.5 text-[11px] font-medium leading-snug text-foreground">
              {t('search.categoryChip')}{' '}
              <strong className="text-foreground">{mapCatResolved.canonical}</strong>
            </p>
          ) : null}
          <MapRosySuggestions
            suggestions={rosySuggestions}
            activeId={activeSuggestionId}
            lang={lang}
            panelTitle={t('map.rosyPanelTitle')}
            onSelect={handleRosySelect}
            onClear={() => setActiveSuggestionId(null)}
          />
        </div>
      </div>

      {/*
        Stack: map layer pinned with a stable key (no remount on filter state).
        Overlays (search/filters) stay in a separate absolute layer — see block above.
      */}
      <div
        ref={mapShellRef}
        className="rosera-map-shell relative z-0 min-h-0 w-full flex-1 basis-0 overflow-hidden overscroll-none touch-pan-x touch-pan-y pb-[calc(5rem+env(safe-area-inset-bottom,0px)+100px)]"
        style={{ minHeight: 0, touchAction: 'pan-x pan-y' }}
        dir="ltr"
      >
        <MapErrorBoundary fallback={<MapFallback />}>
          {mapShellVisible ? (
            <Suspense
              fallback={
                <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-gradient-to-br from-muted/80 via-background to-muted/40">
                  <div className="relative mx-4 h-36 w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-card shadow-inner ring-1 ring-border/50">
                    <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-primary/20 via-primary/10 to-muted/40" />
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-background/80 to-transparent animate-map-shimmer"
                      aria-hidden
                    />
                  </div>
                  <p className="mt-5 text-xs font-medium text-foreground">{t('map.loadingOverlay')}</p>
                </div>
              }
            >
              <div key="rosera_map" className="relative h-full min-h-0 w-full flex-1 isolate">
                <MapPageMap
                  centerLat={safeMapCenter[0]}
                  centerLng={safeMapCenter[1]}
                  zoom={mapZoom}
                  markerStore={mapMarkerStore}
                  mapInstanceRef={mapInstanceRef}
                  onViewportBoundsIdle={handleViewportBoundsIdle}
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
              </div>
            </Suspense>
          ) : (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center bg-gradient-to-br from-muted/75 via-background to-muted/30">
              <div className="mx-4 h-32 w-full max-w-[min(100%,28rem)] animate-pulse rounded-3xl bg-gradient-to-r from-primary/15 via-muted/50 to-muted/30" />
              <p className="mt-4 text-xs font-medium text-foreground">{t('map.loadingOverlay')}</p>
            </div>
          )}
        </MapErrorBoundary>
        <div
          className={cn(
            'pointer-events-none absolute inset-0 z-sticky-section flex items-center justify-center bg-background/80 transition-opacity duration-500 ease-out backdrop-blur-sm',
            mapLoading ? 'opacity-100' : 'opacity-0'
          )}
          aria-busy={mapLoading}
          aria-hidden={!mapLoading}
        >
          <div className="flex max-w-[min(100%,18rem)] flex-col items-center gap-4 rounded-3xl border border-border bg-card px-8 py-6 text-center shadow-floating backdrop-blur-sm ring-1 ring-border/50 animate-premium-in">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/25 [animation-duration:1.8s]" aria-hidden />
              <RefreshCw className="relative h-8 w-8 animate-spin text-primary" aria-hidden />
            </div>
            <p className="text-sm font-semibold leading-snug text-foreground">{t('map.loadingOverlay')}</p>
          </div>
        </div>
      </div>

      <Button
        type="button"
        size="icon"
        variant="default"
        className="absolute right-4 z-map h-12 w-12 shadow-lg"
        style={{ bottom: MAP_BOTTOM_SAFE }}
        onClick={() => centerOnUser()}
        aria-label={lang === 'ar' ? 'توسيط الخريطة على موقعك' : 'Center map on your location'}
      >
        <Crosshair className="h-6 w-6 text-foreground" />
      </Button>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute left-4 z-map shadow-md"
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
          className="absolute start-4 end-4 z-map max-w-lg mx-auto animate-in slide-in-from-bottom-4"
          style={{
            bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px) + 100px + 3.75rem)',
          }}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <Card className="relative overflow-hidden border-border p-5 shadow-floating ring-1 ring-border/50">
            <button type="button" className="absolute top-2 end-2 z-raised text-rosera-gray" onClick={() => setSelected(null)}>
              ✕
            </button>
            <div className="min-w-0 pe-8">
              <p dir="auto" className="text-start font-bold text-foreground line-clamp-2">
                {selected.name_ar}
              </p>
              {topSalonIds.has(String(selected.id)) && (
                <span className="mt-1 inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  {t('map.topSalonBadge')}
                </span>
              )}
              <div
                dir="ltr"
                className="mt-1 flex items-center justify-start gap-1 text-primary [unicode-bidi:isolate]"
              >
                <Star className="h-4 w-4 shrink-0 fill-primary text-primary" aria-hidden />
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

      <MapFilterDrawer
        isOpen={mapFilterDrawerCategory != null}
        config={
          mapFilterDrawerCategory ? MAP_FILTER_DRAWER_CONFIGS[mapFilterDrawerCategory] : null
        }
        selectedOptions={mapFilterDrawerDraft}
        onToggleOption={toggleMapFilterDraftOption}
        onClearCategory={clearMapFilterCategory}
        onClose={closeMapFilterDrawer}
        onApply={handleMapFilterApply}
      />
    </div>
  )
}
