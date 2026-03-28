import { useEffect, useRef, useState } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { getGoogleMapsApiKey } from '@/lib/googleMapsEnv'
import { clearStaleGoogleMapsScript } from '@/lib/googleMapsLoaderBootstrap'
import { cn } from '@/lib/utils'

type Props = {
  latitude: number | null
  longitude: number | null
  onLocationChange: (lat: number, lng: number) => void
  className?: string
}

const FALLBACK = { lat: 26.2172, lng: 50.1971 }

async function waitForSize(el: HTMLElement, cancelled: () => boolean): Promise<boolean> {
  const deadline = Date.now() + 12000
  while (Date.now() < deadline) {
    if (cancelled()) return false
    const { width, height } = el.getBoundingClientRect()
    if (width >= 2 && height >= 2) return true
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }
  return false
}

export function SalonMapPicker({ latitude, longitude, onLocationChange, className }: Props) {
  const elRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const latRef = useRef(latitude)
  const lngRef = useRef(longitude)
  latRef.current = latitude
  lngRef.current = longitude
  const [ready, setReady] = useState(false)
  const [asyncErr, setAsyncErr] = useState<string | null>(null)
  const apiKey = getGoogleMapsApiKey().trim()
  const configErr = !apiKey ? 'مفتاح خرائط غير مضبوط' : null
  const err = configErr ?? asyncErr

  useEffect(() => {
    const el = elRef.current
    if (!el || !apiKey) {
      return
    }

    let disposed = false

    void (async () => {
      try {
        const ok = await waitForSize(el, () => disposed)
        if (disposed || !ok || !elRef.current) return

        clearStaleGoogleMapsScript()
        setOptions({ key: apiKey, v: 'weekly' })
        await importLibrary('maps')
        if (disposed || !elRef.current) return
        const g = globalThis.google?.maps
        if (!g?.Map || !g.Marker) {
          setAsyncErr('تعذر تحميل مكتبة الخرائط')
          return
        }

        const lat0 = latRef.current
        const lng0 = lngRef.current
        const startLat = typeof lat0 === 'number' && Number.isFinite(lat0) ? lat0 : FALLBACK.lat
        const startLng = typeof lng0 === 'number' && Number.isFinite(lng0) ? lng0 : FALLBACK.lng

        const map = new g.Map(elRef.current, {
          center: { lat: startLat, lng: startLng },
          zoom: 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        })
        mapRef.current = map

        const marker = new g.Marker({
          map,
          position: { lat: startLat, lng: startLng },
          draggable: true,
        })
        markerRef.current = marker

        marker.addListener('dragend', () => {
          const p = marker.getPosition()
          if (!p) return
          const lat = p.lat()
          const lng = p.lng()
          if (Number.isFinite(lat) && Number.isFinite(lng)) onLocationChange(lat, lng)
        })

        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          const latLng = e.latLng
          if (!latLng) return
          const lat = latLng.lat()
          const lng = latLng.lng()
          marker.setPosition(latLng)
          onLocationChange(lat, lng)
        })

        if (disposed) return
        setReady(true)
        setAsyncErr(null)
      } catch (e) {
        if (!disposed) {
          setAsyncErr(e instanceof Error ? e.message : 'تعذر تحميل الخريطة')
        }
      }
    })()

    return () => {
      disposed = true
      markerRef.current = null
      mapRef.current = null
    }
  }, [onLocationChange, apiKey])

  useEffect(() => {
    const m = mapRef.current
    const mk = markerRef.current
    if (!m || !mk || !ready) return
    if (latitude == null || longitude == null) return
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
    const c = m.getCenter()
    if (c && Math.abs(c.lat() - latitude) < 1e-6 && Math.abs(c.lng() - longitude) < 1e-6) {
      mk.setPosition({ lat: latitude, lng: longitude })
      return
    }
    m.panTo({ lat: latitude, lng: longitude })
    mk.setPosition({ lat: latitude, lng: longitude })
  }, [latitude, longitude, ready])

  return (
    <div className={cn('space-y-2', className)} dir="rtl">
      <div
        ref={elRef}
        className="relative h-56 w-full overflow-hidden rounded-2xl border border-primary/15 bg-muted/30 sm:h-64"
        style={{ direction: 'ltr' }}
      />
      {err ? <p className="text-sm font-medium text-destructive">{err}</p> : null}
      {!ready && !err ? <p className="text-xs text-foreground">جاري تحميل الخريطة…</p> : null}
      <p className="text-xs text-foreground">انقري على الخريطة أو اسحبي الدبوس لتحديد موقع الصالون</p>
    </div>
  )
}
