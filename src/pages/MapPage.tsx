import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Crosshair, MapPin } from 'lucide-react'
import { supabase, type Business } from '@/lib/supabase'
import { haversineKm } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Star } from 'lucide-react'
import { toast } from 'sonner'

const SA_CENTER: [number, number] = [24.0, 45.0]
const SA_ZOOM = 6

const purpleIcon = new L.DivIcon({
  className: 'custom-pin',
  html: `<div style="width:28px;height:28px;background:linear-gradient(135deg,#9C27B0,#E91E8C);border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.2)"></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
})

function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 })
  }, [center, zoom, map])
  return null
}

export default function MapPage() {
  const nav = useNavigate()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Business | null>(null)
  const [mapCenter, setMapCenter] = useState<[number, number]>(SA_CENTER)
  const [mapZoom, setMapZoom] = useState(SA_ZOOM)
  const [userPos, setUserPos] = useState<[number, number] | null>(null)
  const [nearestSheetOpen, setNearestSheetOpen] = useState(false)

  useEffect(() => {
    let c = true
    async function load() {
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('is_active', true)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
        if (error) throw error
        if (c) setBusinesses((data ?? []) as Business[])
      } catch {
        toast.error('تعذر تحميل الخريطة')
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!q.trim()) return businesses
    const qq = q.trim()
    return businesses.filter(
      (b) =>
        b.name_ar.includes(qq) ||
        b.city.includes(qq) ||
        (b.region && b.region.includes(qq)) ||
        (b.category_label && b.category_label.includes(qq))
    )
  }, [businesses, q])

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
      () => toast.error('فعّلي الموقع')
    )
  }

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-rosera-dark" dir="ltr">
      <div className="absolute start-0 end-0 top-0 z-[500] space-y-2 p-3 pt-safe" dir="rtl">
        <div className="relative mx-auto max-w-lg">
          <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-rosera-gray" />
          <Input
            className="rounded-2xl bg-white/95 ps-10 shadow-lg"
            placeholder="بحث عن صالون أو مدينة..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex justify-center mt-2" dir="rtl">
          <Button
            type="button"
            size="sm"
            className="rounded-full bg-white/95 text-foreground shadow-lg gap-1"
            onClick={goToNearest}
          >
            <MapPin className="h-4 w-4 text-[#E91E8C]" />
            الأقرب إليك
          </Button>
        </div>
      </div>

      <MapContainer center={SA_CENTER} zoom={SA_ZOOM} className="h-full w-full" style={{ direction: 'ltr' }} scrollWheelZoom>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FlyTo center={mapCenter} zoom={mapZoom} />
        {filtered.map((b) => (
          <Marker
            key={b.id}
            position={[b.latitude!, b.longitude!]}
            icon={purpleIcon}
            eventHandlers={{
              click: () => {
                setSelected(b)
                setMapCenter([b.latitude!, b.longitude!])
                setMapZoom(13)
              },
            }}
          >
            <Popup>
              <div className="min-w-[140px] text-center" dir="rtl">
                <p className="flex items-center justify-center gap-1 font-bold text-[#1f2937]">
                  <Star className="h-4 w-4 fill-[#C9A227] text-[#C9A227]" />
                  {Number(b.average_rating ?? 0).toFixed(1)}
                </p>
                <Link to={`/salon/${b.id}`} className="mt-1 block text-sm font-bold text-[#E91E8C] hover:underline">
                  {b.name_ar}
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
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
              setMapZoom(11)
            },
            () => toast.error('فعّلي الموقع')
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
          setMapCenter(SA_CENTER)
          setMapZoom(SA_ZOOM)
          setSelected(null)
        }}
      >
        السعودية
      </Button>

      {selected && (
        <div
          className="absolute bottom-20 start-4 end-4 z-[500] max-w-lg mx-auto animate-in slide-in-from-bottom-4"
          dir="rtl"
        >
          <Card className="flex gap-3 overflow-hidden border-primary/20 p-3 shadow-2xl">
            <img
              src={selected.cover_image || selected.images?.[0] || ''}
              alt=""
              className="h-24 w-24 shrink-0 rounded-xl object-cover"
            />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                className="text-start font-bold text-foreground hover:text-primary line-clamp-2"
                onClick={() => nav(`/salon/${selected.id}`)}
              >
                {selected.name_ar}
              </button>
              <div className="mt-1 flex items-center gap-1 text-[#C9A227]">
                <Star className="h-4 w-4 fill-[#C9A227]" />
                {Number(selected.average_rating ?? 0).toFixed(1)}
              </div>
              {userPos && selected.latitude != null && selected.longitude != null && (
                <p className="text-xs text-rosera-gray">
                  {haversineKm(userPos[0], userPos[1], selected.latitude, selected.longitude).toFixed(1)} كم
                </p>
              )}
              <Button size="sm" className="mt-2 rounded-xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={() => nav(`/salon/${selected.id}`)}>
                صفحة الصالون
              </Button>
            </div>
            <button type="button" className="text-rosera-gray shrink-0" onClick={() => setSelected(null)}>
              ✕
            </button>
          </Card>
        </div>
      )}

      {nearestSheetOpen && (
        <div className="absolute bottom-0 start-0 end-0 z-[500] max-h-[45vh] overflow-hidden rounded-t-3xl bg-white shadow-2xl dark:bg-card" dir="rtl">
          <div className="sticky top-0 flex items-center justify-between border-b border-primary/10 bg-white p-4 dark:bg-card">
            <h3 className="font-bold">الأقرب إليك</h3>
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
                    <p className="text-xs text-rosera-gray">{Number(km).toFixed(1)} كم · {Number(b.average_rating ?? 0).toFixed(1)} ★</p>
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
