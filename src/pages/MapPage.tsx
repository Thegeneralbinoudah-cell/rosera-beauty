import { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Crosshair, MapPin, ChevronLeft } from 'lucide-react'
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

const DEFAULT_CENTER: [number, number] = [26.4207, 50.0888] // Dammam
const DEFAULT_ZOOM = 12
const MAP_PREFS_KEY = 'rosera:map:prefs'

const clusterIcon = (cluster: { getChildCount: () => number }) =>
  L.divIcon({
    html: `<div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#9C27B0,#E91E8C);color:#fff;font-weight:800;border:3px solid #fff;box-shadow:0 6px 16px rgba(0,0,0,.25)">${cluster.getChildCount()}</div>`,
    className: 'rosera-cluster-icon',
    iconSize: L.point(40, 40, true),
  })

const pinWithRatingIcon = (rating: number) =>
  new L.DivIcon({
    className: 'rosera-rated-pin',
    html: `
      <div style="position:relative;width:58px;height:48px;display:flex;align-items:flex-start;justify-content:center;">
        <div style="position:absolute;top:0;left:50%;transform:translateX(-50%);padding:2px 8px;border-radius:999px;background:#ffffff;border:1px solid rgba(0,0,0,.08);box-shadow:0 2px 8px rgba(0,0,0,.18);font-size:11px;font-weight:800;color:#1F1F1F;line-height:1.2;white-space:nowrap;">
          ${Number(rating || 0).toFixed(1)} <span style="color:#9B2257">★</span>
        </div>
        <div style="position:absolute;top:18px;left:50%;transform:translateX(-50%) rotate(-45deg);width:24px;height:24px;background:linear-gradient(135deg,#9C27B0,#E91E8C);border-radius:50% 50% 50% 0;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.24);"></div>
      </div>
    `,
    iconSize: [58, 48],
    iconAnchor: [29, 42],
    popupAnchor: [0, -36],
  })

function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 })
  }, [center, zoom, map])
  return null
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
  const [q, setQ] = useState(initialQ)
  const [selected, setSelected] = useState<Business | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>(DEFAULT_CENTER)
  const [mapZoom, setMapZoom] = useState(DEFAULT_ZOOM)
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [nearestSheetOpen, setNearestSheetOpen] = useState(false)
  const [regionFilter, setRegionFilter] = useState<'all' | 'eastern'>(initialRegion)
  const [sortBy, setSortBy] = useState<'rating' | 'booked' | 'nearest' | 'name' | 'newest'>(initialSort)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const openDirections = (lat: number | null | undefined, lng: number | null | undefined) => {
    console.log('[directions]', { latitude: lat, longitude: lng })
    if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      toast.error(t('map.coordsMissing'))
      return
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    const win = window.open(url, '_blank', 'noopener,noreferrer')
    if (!win) window.location.href = url
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

  useEffect(() => {
    let c = true
    async function load() {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('is_active', true)
          .eq('is_demo', false)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
        if (error) throw error
        if (c) setBusinesses((data ?? []) as Business[])
      } catch {
        toast.error(t('map.loadError'))
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [])

  useEffect(() => {
    if (sortBy === 'name') {
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 150)
      return () => window.clearTimeout(t)
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
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos: [number, number] = [p.coords.latitude, p.coords.longitude]
        setUserPos(pos)
        setMapCenter(pos)
        setMapZoom(12)
      },
      () => {
        setMapCenter(DEFAULT_CENTER)
        setMapZoom(DEFAULT_ZOOM)
      },
      { enableHighAccuracy: true, timeout: 6000 }
    )
  }, [])

  const filtered = useMemo(() => {
    const qq = q.trim()
    let rows = businesses.filter((b) => {
      const inText =
        !qq ||
        b.name_ar.includes(qq) ||
        b.city.includes(qq) ||
        (b.region && b.region.includes(qq)) ||
        (b.category_label && b.category_label.includes(qq))
      const inRegion =
        regionFilter === 'all' ||
        (b.region?.includes('الشرقية') || b.region?.includes('المنطقة الشرقية'))
      return inText && inRegion
    })

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
    } else if (sortBy === 'nearest' && userPos) {
      rows = [...rows].sort(
        (a, b) =>
          haversineKm(userPos[0], userPos[1], a.latitude!, a.longitude!) -
          haversineKm(userPos[0], userPos[1], b.latitude!, b.longitude!)
      )
    } else if (sortBy === 'name') {
      rows = [...rows].sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'))
    } else if (sortBy === 'newest') {
      rows = [...rows].sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0
        return tb - ta
      })
    }
    return rows
  }, [businesses, q, regionFilter, sortBy, userPos])

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
    if (!userPos) return filtered.map((b) => ({ b, km: 0 }))
    return filtered
      .map((b) => ({ b, km: haversineKm(userPos[0], userPos[1], b.latitude!, b.longitude!) }))
      .sort((a, b) => a.km - b.km)
  }, [filtered, userPos])

  const goToNearest = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos: [number, number] = [p.coords.latitude, p.coords.longitude]
        setUserPos(pos)
        setMapCenter(pos)
        setMapZoom(12)
        setNearestSheetOpen(true)
      },
      () => toast.error(t('map.enableLocation'))
    )
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-rosera-dark" dir="ltr">
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

      <MapContainer center={mapCenter} zoom={mapZoom} className="h-full w-full" style={{ direction: 'ltr' }} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FlyTo center={mapCenter} zoom={mapZoom} />
        <MarkerClusterGroup
          chunkedLoading
          iconCreateFunction={clusterIcon}
          maxClusterRadius={50}
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
        >
          {filtered.map((b) => (
            <Marker
              key={b.id}
              position={[b.latitude!, b.longitude!]}
              icon={pinWithRatingIcon(Number(b.average_rating ?? 0))}
              eventHandlers={{
                click: () => {
                  setSelected(b)
                  setMapCenter([b.latitude!, b.longitude!])
                  setMapZoom(13)
                },
              }}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      <Button
        type="button"
        size="icon"
        className="absolute bottom-28 end-4 z-[500] h-12 w-12 rounded-full border-0 bg-gradient-to-br from-[#9C27B0] to-[#E91E8C] shadow-lg"
        onClick={() => {
          navigator.geolocation.getCurrentPosition(
            (p) => {
              const pos: [number, number] = [p.coords.latitude, p.coords.longitude]
              setUserPos(pos)
              setMapCenter(pos)
              setMapZoom(12)
            },
            () => toast.error(t('map.enableLocation'))
          )
        }}
      >
        <Crosshair className="h-6 w-6 text-white" />
      </Button>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="absolute bottom-28 start-4 z-[500] rounded-full shadow-lg"
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
          className="absolute bottom-20 start-4 end-4 z-[500] max-w-lg mx-auto animate-in slide-in-from-bottom-4"
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
        >
          <Card className="relative overflow-hidden border-primary/20 p-4 shadow-2xl">
            <button type="button" className="absolute top-2 end-2 z-10 text-rosera-gray" onClick={() => setSelected(null)}>
              ✕
            </button>
            <div className="min-w-0 pe-8">
              <p className="text-start font-bold text-foreground line-clamp-2">{selected.name_ar}</p>
              <div className="mt-1 flex items-center gap-1 text-[#9B2257]">
                <Star className="h-4 w-4 fill-[#9B2257] text-[#9B2257]" />
                {Number(selected.average_rating ?? 0).toFixed(1)}
              </div>
              {userPos && selected.latitude != null && selected.longitude != null && (
                <p className="text-xs text-rosera-gray">
                  {haversineKm(userPos[0], userPos[1], selected.latitude, selected.longitude).toFixed(1)} {t('common.km')}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" className="rounded-xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={() => nav('/salon/' + selected.id)}>
                  {t('map.viewDetails')}
                </Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openDirections(selected.latitude, selected.longitude)}>
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
                    setSelected(b)
                    setMapCenter([b.latitude!, b.longitude!])
                    setMapZoom(14)
                    setNearestSheetOpen(false)
                  }}
                >
                  <img src={b.cover_image || b.images?.[0] || ''} alt="" className="h-12 w-12 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold line-clamp-1">{b.name_ar}</p>
                    <p className="text-xs text-rosera-gray">{Number(km).toFixed(1)} {t('common.km')} · {Number(b.average_rating ?? 0).toFixed(1)} ★</p>
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
