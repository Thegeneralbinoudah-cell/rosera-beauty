import { memo, useEffect, useRef, useState } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { MarkerClusterer, type Renderer } from '@googlemaps/markerclusterer'
import type { Business } from '@/lib/supabase'
import type { MapMarkerRow } from '@/lib/mapMarkers'
import { GOOGLE_MAPS_API_KEY_EMBEDDED } from '@/config/googleMapsApiKey'
import { clearStaleGoogleMapsScript } from '@/lib/googleMapsLoaderBootstrap'

/** دوائر تجميع بألوان روزيرا */
const roseraClusterRenderer: Renderer = {
  render({ count, position }, _stats, _map) {
    const scale = Math.min(26, 12 + Math.min(count, 24) * 0.65)
    return new google.maps.Marker({
      position,
      label: {
        text: String(count),
        color: '#374151',
        fontSize: '11px',
        fontWeight: '700',
        className: 'rosera-map-pin-rating-label',
      },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale,
        fillColor: '#F9A8C9',
        fillOpacity: 0.95,
        strokeColor: '#FDF2F8',
        strokeWeight: 2,
      },
      zIndex: 600 + count,
    })
  },
}

const MAP_IDLE_DEBOUNCE_MS = 500
const RESIZE_DEBOUNCE_MS = 500

async function waitForNonZeroSize(el: HTMLElement, isDisposed: () => boolean): Promise<boolean> {
  const deadline = Date.now() + 16000
  while (Date.now() < deadline) {
    if (isDisposed()) return false
    const { width, height } = el.getBoundingClientRect()
    if (width >= 2 && height >= 2) return true
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
  }
  return false
}

/** تحميل أول ثابت فقط — يقلّل إعادة رسم الكاميرا عند تغيّر props الأب */
const INITIAL_MAP_CENTER_LAT = 26.2172
const INITIAL_MAP_CENTER_LNG = 50.1971
const INITIAL_MAP_ZOOM = 12

type Props = {
  /** إحداثيات منفصلة — لا تمرير مصفوفة جديدة في كل تصيير */
  centerLat: number
  centerLng: number
  zoom: number
  markers: MapMarkerRow[]
  /** يُمرَّر من الأب — للمقارنة في memo دون الاعتماد على مرجع markers */
  markersSignature: string
  userPosition: [number, number] | null
  onMarkerClick: (b: Business, pos: [number, number]) => void
  /** يبرز الدبوس ويتحرك قليلاً عند اختيار صالون من البطاقة */
  highlightMarkerId?: string | null
  bottomPaddingPx: number
  /** حشوة أفقية حتى لا تتداخل أرجاء Google مع زر الرجوع/التحكم — الخريطة تبقى dir=ltr */
  leftPaddingPx?: number
  rightPaddingPx?: number
  /** يُستدعى بعد توقف الكاميرا (idle) لمدة 500ms — لجلب بيانات لاحقاً دون إعادة تهيئة الخريطة */
  onMapIdleSettled?: () => void
}

function GoogleMapViewInner({
  centerLat,
  centerLng,
  zoom,
  markers,
  markersSignature,
  userPosition,
  onMarkerClick,
  highlightMarkerId = null,
  bottomPaddingPx,
  leftPaddingPx = 0,
  rightPaddingPx = 0,
  onMapIdleSettled,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  /** مثيل الخريطة الوحيد — لا يُعاد إنشاؤه عند تغيّر state في الأب */
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const userMarkerRef = useRef<google.maps.Marker | null>(null)
  const lastProgrammaticViewRef = useRef<{ lat: number; lng: number; z: number } | null>(null)

  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick

  const onMapIdleSettledRef = useRef<Props['onMapIdleSettled']>(undefined)
  onMapIdleSettledRef.current = onMapIdleSettled

  const [mapReady, setMapReady] = useState(false)

  /** مثيل واحد: إنشاء الخريطة مرة، وإزالة المستمعين وكل الطبقات عند التفكيك */
  useEffect(() => {
    const el = containerRef.current
    const apiKey = GOOGLE_MAPS_API_KEY_EMBEDDED.trim()
    if (!el || !apiKey) {
      return
    }

    let disposed = false
    let idleDebounceTimer: ReturnType<typeof setTimeout> | null = null
    let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null
    let idleListener: google.maps.MapsEventListener | null = null
    let resizeObserver: ResizeObserver | null = null
    let orientHandler: (() => void) | null = null

    void (async () => {
      try {
        if (googleMapInstanceRef.current) return

        const hasLayout = await waitForNonZeroSize(el, () => disposed)
        if (disposed || !hasLayout || !containerRef.current) return
        if (googleMapInstanceRef.current) return

        const mountEl = containerRef.current

        clearStaleGoogleMapsScript()
        setOptions({ key: apiKey, v: 'weekly' })
        const mapsLib = await importLibrary('maps')
        await importLibrary('marker')
        if (disposed || !containerRef.current) return
        if (googleMapInstanceRef.current) return

        const map = new mapsLib.Map(mountEl, {
          center: { lat: INITIAL_MAP_CENTER_LAT, lng: INITIAL_MAP_CENTER_LNG },
          zoom: INITIAL_MAP_ZOOM,
          mapTypeId: mapsLib.MapTypeId.ROADMAP,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          clickableIcons: false,
        })
        if (disposed) return

        googleMapInstanceRef.current = map
        lastProgrammaticViewRef.current = {
          lat: INITIAL_MAP_CENTER_LAT,
          lng: INITIAL_MAP_CENTER_LNG,
          z: INITIAL_MAP_ZOOM,
        }
        map.setOptions({
          mapTypeControl: false,
          streetViewControl: false,
          padding: {
            bottom: bottomPaddingPx,
            top: 0,
            left: leftPaddingPx,
            right: rightPaddingPx,
          },
        } as google.maps.MapOptions)
        setMapReady(true)
        /** مزامنة طبقة البلاط بعد أول إطار — يقلّل وميض «No imagery» عند صندوق 0×0 */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (googleMapInstanceRef.current) {
              google.maps.event.trigger(googleMapInstanceRef.current, 'resize')
            }
          })
        })

        idleListener = google.maps.event.addListener(map, 'idle', () => {
          if (idleDebounceTimer) clearTimeout(idleDebounceTimer)
          idleDebounceTimer = setTimeout(() => {
            idleDebounceTimer = null
            if (googleMapInstanceRef.current) {
              google.maps.event.trigger(googleMapInstanceRef.current, 'resize')
            }
            onMapIdleSettledRef.current?.()
          }, MAP_IDLE_DEBOUNCE_MS)
        })

        resizeObserver = new ResizeObserver(() => {
          if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer)
          resizeDebounceTimer = setTimeout(() => {
            resizeDebounceTimer = null
            if (googleMapInstanceRef.current) {
              google.maps.event.trigger(googleMapInstanceRef.current, 'resize')
            }
          }, RESIZE_DEBOUNCE_MS)
        })
        resizeObserver.observe(mountEl)

        orientHandler = () => {
          setTimeout(() => {
            if (googleMapInstanceRef.current) {
              google.maps.event.trigger(googleMapInstanceRef.current, 'resize')
            }
          }, 250)
        }
        window.addEventListener('orientationchange', orientHandler)
      } catch {
        /* فشل تحميل الخرائط — الواجهة تبقى بدون خريطة دون إسقاط التطبيق */
      }
    })()

    return () => {
      disposed = true
      if (idleDebounceTimer) clearTimeout(idleDebounceTimer)
      if (resizeDebounceTimer) clearTimeout(resizeDebounceTimer)
      if (idleListener) {
        google.maps.event.removeListener(idleListener)
        idleListener = null
      }
      resizeObserver?.disconnect()
      if (orientHandler) window.removeEventListener('orientationchange', orientHandler)

      if (clustererRef.current) {
        try {
          clustererRef.current.clearMarkers()
          clustererRef.current.setMap(null)
        } catch {
          /* ignore */
        }
        clustererRef.current = null
      }

      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null)
        userMarkerRef.current = null
      }

      const map = googleMapInstanceRef.current
      if (map) {
        try {
          google.maps.event.clearInstanceListeners(map)
        } catch {
          /* ignore */
        }
      }
      googleMapInstanceRef.current = null
      lastProgrammaticViewRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- تهيئة مرة واحدة؛ المركز/الزوم يُحدَّثان في تأثير منفصل
  }, [])

  useEffect(() => {
    const map = googleMapInstanceRef.current
    if (!map || !mapReady) return
    map.setOptions({
      mapTypeControl: false,
      streetViewControl: false,
      padding: {
        bottom: bottomPaddingPx,
        top: 0,
        left: leftPaddingPx,
        right: rightPaddingPx,
      },
    } as google.maps.MapOptions)
  }, [bottomPaddingPx, leftPaddingPx, rightPaddingPx, mapReady])

  /** أرقام فقط في deps — السحب لا يمرّر center جديداً من الأب؛ التحديث البرمجي فقط */
  useEffect(() => {
    const map = googleMapInstanceRef.current
    if (!map || !mapReady) return
    const lat = centerLat
    const lng = centerLng
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    const p = lastProgrammaticViewRef.current
    if (
      p &&
      Math.abs(p.lat - lat) < 1e-6 &&
      Math.abs(p.lng - lng) < 1e-6 &&
      Math.abs(p.z - zoom) < 0.02
    ) {
      return
    }
    lastProgrammaticViewRef.current = { lat, lng, z: zoom }
    map.panTo({ lat, lng })
    map.setZoom(zoom)
  }, [centerLat, centerLng, zoom, mapReady])

  useEffect(() => {
    const map = googleMapInstanceRef.current
    if (!map || !mapReady) return

    void importLibrary('marker').then((markerLib) => {
      if (!googleMapInstanceRef.current) return
      const mapInst = googleMapInstanceRef.current

      const symDefault: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 11,
        fillColor: '#F9A8C9',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      }
      const symTop: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: '#BE185D',
        fillOpacity: 1,
        strokeColor: '#FBBF24',
        strokeWeight: 3,
      }
      const symSelected: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 17,
        fillColor: '#F9A8C9',
        fillOpacity: 1,
        strokeColor: '#BE185D',
        strokeWeight: 4,
      }

      const created: google.maps.Marker[] = []
      for (const row of markers) {
        const lat = row.position?.[0]
        const lng = row.position?.[1]
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
        const nameAr = row.b.name_ar?.trim() || row.b.name_en || ''
        const titleRtl = nameAr ? `${nameAr} · ${row.pinRatingLabel}` : row.pinRatingLabel
        const isTop = row.tier === 'top'
        const isHi = Boolean(highlightMarkerId && row.id === highlightMarkerId)
        const icon = isHi ? symSelected : isTop ? symTop : symDefault
        const m = new markerLib.Marker({
          position: { lat: lat as number, lng: lng as number },
          title: titleRtl,
          icon,
          optimized: true,
          zIndex: isHi ? 4000 : isTop ? 500 : 100,
          label: {
            text: row.pinRatingLabel,
            color: isHi ? '#1F2937' : '#ffffff',
            fontSize: isHi ? '12px' : isTop ? '12px' : '11px',
            fontWeight: 'bold',
            className: 'rosera-map-pin-rating-label',
          },
        })
        m.addListener('click', () => {
          onMarkerClickRef.current(row.b, row.position)
        })
        created.push(m)
      }

      if (highlightMarkerId) {
        for (let i = 0; i < markers.length; i++) {
          if (markers[i].id === highlightMarkerId) {
            const mk = created[i]
            if (mk) {
              mk.setAnimation(google.maps.Animation.BOUNCE)
              window.setTimeout(() => {
                try {
                  mk.setAnimation(null)
                } catch {
                  /* ignore */
                }
              }, 700)
            }
            break
          }
        }
      }

      if (created.length === 0) {
        clustererRef.current?.clearMarkers()
        return
      }

      if (clustererRef.current) {
        clustererRef.current.clearMarkers()
        clustererRef.current.addMarkers(created)
      } else {
        clustererRef.current = new MarkerClusterer({
          map: mapInst,
          markers: created,
          renderer: roseraClusterRenderer,
        })
      }
    })
  }, [markersSignature, mapReady, highlightMarkerId])

  const userLat = userPosition?.[0]
  const userLng = userPosition?.[1]

  useEffect(() => {
    const map = googleMapInstanceRef.current
    if (!map || !mapReady) return

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null)
      userMarkerRef.current = null
    }
    if (userLat == null || userLng == null) return
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return

    void importLibrary('marker').then((markerLib) => {
      if (!googleMapInstanceRef.current) return
      userMarkerRef.current = new markerLib.Marker({
        position: { lat: userLat, lng: userLng },
        map: googleMapInstanceRef.current,
        title: 'موقعك',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 3,
        },
        zIndex: 9999,
      })
    })
  }, [userLat, userLng, mapReady])

  return (
    <div
      ref={containerRef}
      className="rosera-google-map-root z-0 min-h-0 min-w-0 flex-1"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100%',
        position: 'relative',
      }}
    />
  )
}

export const GoogleMapView = memo(GoogleMapViewInner, (prev, next) => {
  return (
    prev.centerLat === next.centerLat &&
    prev.centerLng === next.centerLng &&
    prev.zoom === next.zoom &&
    prev.bottomPaddingPx === next.bottomPaddingPx &&
    prev.leftPaddingPx === next.leftPaddingPx &&
    prev.rightPaddingPx === next.rightPaddingPx &&
    prev.markersSignature === next.markersSignature &&
    prev.highlightMarkerId === next.highlightMarkerId &&
    prev.userPosition?.[0] === next.userPosition?.[0] &&
    prev.userPosition?.[1] === next.userPosition?.[1] &&
    prev.onMarkerClick === next.onMarkerClick &&
    prev.onMapIdleSettled === next.onMapIdleSettled
  )
})
