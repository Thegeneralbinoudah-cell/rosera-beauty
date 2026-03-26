import type { MutableRefObject } from 'react'
import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import {
  MarkerClusterer,
  MarkerUtils,
  SuperClusterAlgorithm,
  type Cluster,
  type Marker as ClusterMarker,
  type Renderer,
} from '@googlemaps/markerclusterer'
import type { Business } from '@/lib/supabase'
import type { MapMarkerRow } from '@/lib/mapMarkers'
import type { MapMarkerStore } from '@/lib/mapMarkerStore'
import { boundsToLatLngBox, type LatLngBoundsBox } from '@/lib/fetchSalonsInBounds'
import { getGoogleMapsMapId } from '@/lib/googleMapsEnv'
import { GOOGLE_MAPS_API_KEY_EMBEDDED } from '@/config/googleMapsApiKey'
import { clearStaleGoogleMapsScript } from '@/lib/googleMapsLoaderBootstrap'

const CLUSTER_ICON_CACHE = new Map<string, string>()

function clusterSizeTier(count: number): 'sm' | 'md' | 'lg' {
  if (count <= 10) return 'sm'
  if (count <= 30) return 'md'
  return 'lg'
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/** دائرة متدرجة وردي → ذهبي + ظل ناعم + عدد واضح */
function getClusterIconDataUrl(count: number): string {
  const tier = clusterSizeTier(count)
  const key = `${tier}:${count}`
  const cached = CLUSTER_ICON_CACHE.get(key)
  if (cached) return cached

  const display = tier === 'sm' ? 44 : tier === 'md' ? 56 : 70
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 2
  const px = Math.round(display * dpr)
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.scale(dpr, dpr)
  const cx = display / 2
  const cy = display / 2
  const rad = display / 2 - 5
  ctx.shadowColor = 'rgba(236, 72, 153, 0.38)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  const grd = ctx.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad)
  grd.addColorStop(0, '#f9a8d4')
  grd.addColorStop(0.45, '#ec4899')
  grd.addColorStop(1, '#f59e0b')
  ctx.beginPath()
  ctx.arc(cx, cy, rad, 0, Math.PI * 2)
  ctx.fillStyle = grd
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'
  ctx.lineWidth = 2.5
  ctx.stroke()
  const fontSize = tier === 'sm' ? 12 : tier === 'md' ? 14 : 16
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(count), cx, cy + 0.5)
  const url = canvas.toDataURL()
  CLUSTER_ICON_CACHE.set(key, url)
  return url
}

function makeClusterRenderer(): Renderer {
  return {
    render(cluster) {
      const count = cluster.count
      const position = cluster.position
      const tier = clusterSizeTier(count)
      const display = tier === 'sm' ? 44 : tier === 'md' ? 56 : 70
      const url = getClusterIconDataUrl(count)
      return new google.maps.Marker({
        position,
        optimized: true,
        icon: {
          url,
          scaledSize: new google.maps.Size(display, display),
          anchor: new google.maps.Point(display / 2, display / 2),
        },
        zIndex: 700 + Math.min(count, 500),
      })
    },
  }
}

const roseraClusterRenderer = makeClusterRenderer()

/** تجميع أقوى (نصف قطر أكبر) */
const ROSERA_CLUSTER_ALGORITHM = new SuperClusterAlgorithm({
  radius: 96,
  maxZoom: 16,
})

const MAP_MARKERS_DEBOUNCE_MS = 120
const MAP_IDLE_DEBOUNCE_MS = 500
const VIEWPORT_IDLE_DEBOUNCE_MS = 350
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
  /** وسيط عزل عن تحديثات الفلتر — لا تمرّري markers كـ prop من شجرة الفلاتر */
  markerStore: MapMarkerStore
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
  /** مرجع لمثيل google.maps.Map — للتحريك/الحدود من MapPage دون إعادة تركيب المكوّن */
  mapInstanceRef?: MutableRefObject<google.maps.Map | null>
  /** بعد توقف الخريطة (idle) بـ 350ms — جلب منشآت ضمن الحدود فقط */
  onViewportBoundsIdle?: (bounds: LatLngBoundsBox) => void
}

function GoogleMapViewInner({
  centerLat,
  centerLng,
  zoom,
  markerStore,
  userPosition,
  onMarkerClick,
  highlightMarkerId = null,
  bottomPaddingPx,
  leftPaddingPx = 0,
  rightPaddingPx = 0,
  onMapIdleSettled,
  mapInstanceRef,
  onViewportBoundsIdle,
}: Props) {
  const mapMarkerSnap = useSyncExternalStore(markerStore.subscribe, markerStore.getSnapshot, markerStore.getSnapshot)
  const markersSignature = mapMarkerSnap.signature
  const markers = mapMarkerSnap.markers

  const containerRef = useRef<HTMLDivElement>(null)
  /** مثيل الخريطة الوحيد — لا يُعاد إنشاؤه عند تغيّر state في الأب */
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null)
  const clustererRef = useRef<MarkerClusterer | null>(null)
  const userMarkerRef = useRef<ClusterMarker | null>(null)
  const lastProgrammaticViewRef = useRef<{ lat: number; lng: number; z: number } | null>(null)
  const highlightBounceTimerRef = useRef<number | null>(null)
  const priorityPinMarkersRef = useRef<ClusterMarker[]>([])
  const clusteredLeafMarkersRef = useRef<ClusterMarker[]>([])
  const zoomListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const markersRef = useRef(markers)
  markersRef.current = markers
  const mapPaddingRef = useRef({ bottom: bottomPaddingPx, left: leftPaddingPx, right: rightPaddingPx })
  mapPaddingRef.current = { bottom: bottomPaddingPx, left: leftPaddingPx, right: rightPaddingPx }

  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick

  const onMapIdleSettledRef = useRef<Props['onMapIdleSettled']>(undefined)
  onMapIdleSettledRef.current = onMapIdleSettled

  const onViewportBoundsIdleRef = useRef<Props['onViewportBoundsIdle']>(undefined)
  onViewportBoundsIdleRef.current = onViewportBoundsIdle

  const [mapReady, setMapReady] = useState(false)
  const [debouncedMarkersSignature, setDebouncedMarkersSignature] = useState(markersSignature)

  useEffect(() => {
    if (!import.meta.env.DEV) return
    console.info('[RoseraMap] GoogleMapView host mounted — expect once per /map navigation')
    return () => {
      console.info('[RoseraMap] GoogleMapView host unmounted')
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedMarkersSignature(markersSignature), MAP_MARKERS_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [markersSignature])

  /** مثيل واحد: إنشاء الخريطة مرة، وإزالة المستمعين وكل الطبقات عند التفكيك */
  useEffect(() => {
    const el = containerRef.current
    const apiKey = GOOGLE_MAPS_API_KEY_EMBEDDED.trim()
    if (!el || !apiKey) {
      return
    }

    let disposed = false
    let idleDebounceTimer: ReturnType<typeof setTimeout> | null = null
    let viewportIdleTimer: ReturnType<typeof setTimeout> | null = null
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

        const mapId = getGoogleMapsMapId()
        const mapOptions = {
          center: { lat: INITIAL_MAP_CENTER_LAT, lng: INITIAL_MAP_CENTER_LNG },
          zoom: INITIAL_MAP_ZOOM,
          mapTypeId: mapsLib.MapTypeId.ROADMAP,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy' as const,
          minZoom: 10,
          maxZoom: 18,
          renderingType: google.maps.RenderingType.VECTOR,
          padding: {
            bottom: bottomPaddingPx,
            top: 0,
            left: leftPaddingPx,
            right: rightPaddingPx,
          },
          ...(mapId ? { mapId } : {}),
        } as google.maps.MapOptions
        const map = new mapsLib.Map(mountEl, mapOptions)
        if (disposed) return

        googleMapInstanceRef.current = map
        if (mapInstanceRef) mapInstanceRef.current = map
        lastProgrammaticViewRef.current = {
          lat: INITIAL_MAP_CENTER_LAT,
          lng: INITIAL_MAP_CENTER_LNG,
          z: INITIAL_MAP_ZOOM,
        }
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
          if (viewportIdleTimer) clearTimeout(viewportIdleTimer)
          viewportIdleTimer = setTimeout(() => {
            viewportIdleTimer = null
            const b = map.getBounds()
            if (b && onViewportBoundsIdleRef.current) {
              onViewportBoundsIdleRef.current(boundsToLatLngBox(b))
            }
          }, VIEWPORT_IDLE_DEBOUNCE_MS)

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
      if (viewportIdleTimer) clearTimeout(viewportIdleTimer)
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

      for (const pm of priorityPinMarkersRef.current) {
        try {
          MarkerUtils.setMap(pm, null)
        } catch {
          /* ignore */
        }
      }
      priorityPinMarkersRef.current = []

      if (userMarkerRef.current) {
        try {
          MarkerUtils.setMap(userMarkerRef.current, null)
        } catch {
          /* ignore */
        }
        userMarkerRef.current = null
      }

      if (highlightBounceTimerRef.current) {
        clearTimeout(highlightBounceTimerRef.current)
        highlightBounceTimerRef.current = null
      }

      const map = googleMapInstanceRef.current
      if (map) {
        try {
          google.maps.event.clearInstanceListeners(map)
        } catch {
          /* ignore */
        }
        try {
          const div = map.getDiv()
          if (div) div.innerHTML = ''
        } catch {
          /* ignore */
        }
      }
      googleMapInstanceRef.current = null
      if (mapInstanceRef) mapInstanceRef.current = null
      lastProgrammaticViewRef.current = null
      setMapReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- تهيئة مرة واحدة؛ المركز/الزوم يُحدَّثان في تأثير منفصل
  }, [mapInstanceRef])

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

    let cancelled = false

    function setLeafOpacity(m: ClusterMarker, op: number) {
      try {
        if (MarkerUtils.isAdvancedMarker(m)) {
          const el = m.content as HTMLElement | null
          if (el) el.style.opacity = String(op)
        } else {
          m.setOpacity(op)
        }
      } catch {
        /* ignore */
      }
    }

    function fadeClusterMarkersIn(marks: ClusterMarker[]) {
      if (marks.length === 0) return
      marks.forEach((m) => setLeafOpacity(m, 0.42))
      const start = performance.now()
      const dur = 300
      function tick(now: number) {
        if (cancelled) return
        const t = Math.min(1, (now - start) / dur)
        const op = 0.42 + (1 - 0.42) * easeOutCubic(t)
        marks.forEach((m) => setLeafOpacity(m, op))
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }

    void importLibrary('marker').then((markerLibRaw) => {
      if (cancelled || !googleMapInstanceRef.current) return
      const mapInst = googleMapInstanceRef.current
      const markerLib = markerLibRaw as google.maps.MarkerLibrary
      const useAdvancedMarkers =
        Boolean(getGoogleMapsMapId()) && MarkerUtils.isAdvancedMarkerAvailable(mapInst)

      for (const pm of priorityPinMarkersRef.current) {
        try {
          MarkerUtils.setMap(pm, null)
        } catch {
          /* ignore */
        }
      }
      priorityPinMarkersRef.current = []
      clusteredLeafMarkersRef.current = []
      if (zoomListenerRef.current) {
        try {
          google.maps.event.removeListener(zoomListenerRef.current)
        } catch {
          /* ignore */
        }
        zoomListenerRef.current = null
      }

      clustererRef.current?.clearMarkers()

      const pinPath =
        'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z'
      const makeSalonPinSymbol = (
        variant: 'default' | 'top' | 'selected' | 'boost' | 'suggestion'
      ): google.maps.Symbol => {
        const scale =
          variant === 'selected'
            ? 1.58
            : variant === 'top'
              ? 1.48
              : variant === 'boost'
                ? 1.46
                : variant === 'suggestion'
                  ? 1.45
                  : 1.4
        const fill =
          variant === 'selected'
            ? '#b91c1c'
            : variant === 'top'
              ? '#dc2626'
              : variant === 'boost'
                ? '#ea580c'
                : variant === 'suggestion'
                  ? '#db2777'
                  : '#ef4444'
        const stroke =
          variant === 'boost' || variant === 'suggestion' ? '#fbbf24' : '#ffffff'
        const strokeW = variant === 'selected' ? 2.5 : variant === 'boost' || variant === 'suggestion' ? 2.5 : 2
        return {
          path: pinPath,
          fillColor: fill,
          fillOpacity: 1,
          strokeColor: stroke,
          strokeWeight: strokeW,
          scale,
          anchor: new google.maps.Point(12, 24),
          labelOrigin: new google.maps.Point(12, 9),
        }
      }

      const pinScaleForVariant = (
        variant: 'default' | 'top' | 'selected' | 'boost' | 'suggestion'
      ): number =>
        variant === 'selected'
          ? 1.58
          : variant === 'top'
            ? 1.48
            : variant === 'boost'
              ? 1.46
              : variant === 'suggestion'
                ? 1.45
                : 1.4

      const rows = markersRef.current
      const markerById = new Map<string, ClusterMarker>()
      const priorityRows: MapMarkerRow[] = []
      const clusterRows: MapMarkerRow[] = []
      for (const row of rows) {
        if (row.priority) priorityRows.push(row)
        else clusterRows.push(row)
      }

      const attachHoverLegacy = (m: google.maps.Marker, icon: google.maps.Symbol) => {
        const baseScale = icon.scale ?? 1.4
        m.addListener('mouseover', () => {
          m.setIcon({ ...icon, scale: baseScale * 1.08 })
        })
        m.addListener('mouseout', () => {
          m.setIcon(icon)
        })
      }

      const attachHoverAdvanced = (el: HTMLElement) => {
        const enter = () => {
          el.style.transform = 'scale(1.08)'
        }
        const leave = () => {
          el.style.transform = 'scale(1)'
        }
        el.addEventListener('mouseenter', enter)
        el.addEventListener('mouseleave', leave)
      }

      const buildOne = (row: MapMarkerRow, mapTarget: google.maps.Map | null): ClusterMarker | null => {
        const lat = row.position?.[0]
        const lng = row.position?.[1]
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
        const nameAr = row.b.name_ar?.trim() || row.b.name_en || ''
        const titleRtl = nameAr ? `${nameAr} · ${row.pinRatingLabel}` : row.pinRatingLabel
        const isTop = row.tier === 'top'
        const isPriority = Boolean(row.priority)
        const isBoostOnly = isPriority && !isTop
        const isHi = Boolean(highlightMarkerId && row.id === highlightMarkerId)
        const isSug =
          Boolean(row.suggestionBoost) && !isHi && !isPriority && !isTop
        const variant: 'default' | 'top' | 'selected' | 'boost' | 'suggestion' = isHi
          ? 'selected'
          : isTop
            ? 'top'
            : isBoostOnly
              ? 'boost'
              : isSug
                ? 'suggestion'
                : 'default'
        const z =
          isHi ? 12000 : isPriority ? 9000 : isSug ? 6500 : isTop ? 500 : 100

        if (useAdvancedMarkers) {
          const fill =
            variant === 'selected'
              ? '#b91c1c'
              : variant === 'top'
                ? '#dc2626'
                : variant === 'boost'
                  ? '#ea580c'
                  : variant === 'suggestion'
                    ? '#db2777'
                    : '#ef4444'
          const stroke =
            variant === 'boost' || variant === 'suggestion' ? '#fbbf24' : '#ffffff'
          const pin = new markerLib.PinElement({
            background: fill,
            borderColor: stroke,
            glyph: row.pinRatingLabel,
            glyphColor: '#ffffff',
            scale: pinScaleForVariant(variant),
          })
          attachHoverAdvanced(pin.element)
          const adv = new markerLib.AdvancedMarkerElement({
            position: { lat: lat as number, lng: lng as number },
            map: mapTarget,
            title: titleRtl,
            content: pin.element,
            zIndex: z,
          })
          adv.addListener('gmp-click', () => {
            onMarkerClickRef.current(row.b, row.position)
          })
          markerById.set(row.id, adv)
          return adv
        }

        const icon = makeSalonPinSymbol(variant)
        const m = new markerLib.Marker({
          position: { lat: lat as number, lng: lng as number },
          map: mapTarget,
          title: titleRtl,
          icon,
          optimized: true,
          zIndex: z,
          label: {
            text: row.pinRatingLabel,
            color: '#ffffff',
            fontSize: isHi ? '12px' : isTop || isBoostOnly || isSug ? '12px' : '11px',
            fontWeight: 'bold',
            className: 'rosera-map-pin-rating-label rosera-map-pin-rating-label--on-red',
          },
        })
        m.addListener('click', () => {
          onMarkerClickRef.current(row.b, row.position)
        })
        attachHoverLegacy(m, icon)
        markerById.set(row.id, m)
        return m
      }

      for (const row of priorityRows) {
        const m = buildOne(row, mapInst)
        if (m) priorityPinMarkersRef.current.push(m)
      }

      const clusterMarkers: ClusterMarker[] = []
      for (const row of clusterRows) {
        const m = buildOne(row, null)
        if (m) clusterMarkers.push(m)
      }
      clusteredLeafMarkersRef.current = clusterMarkers

      if (highlightBounceTimerRef.current) {
        clearTimeout(highlightBounceTimerRef.current)
        highlightBounceTimerRef.current = null
      }
      if (highlightMarkerId) {
        const mk = markerById.get(highlightMarkerId)
        if (mk && !MarkerUtils.isAdvancedMarker(mk)) {
          mk.setAnimation(google.maps.Animation.BOUNCE)
          highlightBounceTimerRef.current = window.setTimeout(() => {
            highlightBounceTimerRef.current = null
            try {
              mk.setAnimation(null)
            } catch {
              /* ignore */
            }
          }, 700)
        }
      }

      const onClusterClick = (
        _: google.maps.MapMouseEvent,
        cluster: Cluster,
        map: google.maps.Map
      ) => {
        const pad = mapPaddingRef.current
        if (cluster.bounds) {
          map.fitBounds(cluster.bounds, {
            top: 32,
            bottom: pad.bottom + 40,
            left: pad.left + 24,
            right: pad.right + 24,
          })
        }
      }

      if (clusterMarkers.length === 0) {
        if (clustererRef.current) {
          try {
            clustererRef.current.setMap(null)
          } catch {
            /* ignore */
          }
          clustererRef.current = null
        }
      } else if (clustererRef.current) {
        clustererRef.current.onClusterClick = onClusterClick
        clustererRef.current.addMarkers(clusterMarkers)
        zoomListenerRef.current = google.maps.event.addListener(mapInst, 'zoom_changed', () => {
          fadeClusterMarkersIn(clusteredLeafMarkersRef.current)
        })
        fadeClusterMarkersIn(clusterMarkers)
      } else {
        clustererRef.current = new MarkerClusterer({
          map: mapInst,
          markers: clusterMarkers,
          algorithm: ROSERA_CLUSTER_ALGORITHM,
          renderer: roseraClusterRenderer,
          onClusterClick,
        })
        zoomListenerRef.current = google.maps.event.addListener(mapInst, 'zoom_changed', () => {
          fadeClusterMarkersIn(clusteredLeafMarkersRef.current)
        })
        fadeClusterMarkersIn(clusterMarkers)
      }
    })

    return () => {
      cancelled = true
      if (zoomListenerRef.current) {
        try {
          google.maps.event.removeListener(zoomListenerRef.current)
        } catch {
          /* ignore */
        }
        zoomListenerRef.current = null
      }
    }
  }, [debouncedMarkersSignature, mapReady, highlightMarkerId])

  const userLat = userPosition?.[0]
  const userLng = userPosition?.[1]

  useEffect(() => {
    const map = googleMapInstanceRef.current
    if (!map || !mapReady) return

    if (userMarkerRef.current) {
      try {
        MarkerUtils.setMap(userMarkerRef.current, null)
      } catch {
        /* ignore */
      }
      userMarkerRef.current = null
    }
    if (userLat == null || userLng == null) return
    if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) return

    void importLibrary('marker').then((markerLibRaw) => {
      if (!googleMapInstanceRef.current) return
      const map = googleMapInstanceRef.current
      const markerLib = markerLibRaw as google.maps.MarkerLibrary
      const useAdv = Boolean(getGoogleMapsMapId()) && MarkerUtils.isAdvancedMarkerAvailable(map)
      if (useAdv) {
        const dot = document.createElement('div')
        dot.style.width = '18px'
        dot.style.height = '18px'
        dot.style.borderRadius = '50%'
        dot.style.background = '#2563eb'
        dot.style.border = '3px solid #fff'
        dot.style.boxShadow = '0 1px 4px rgba(0,0,0,0.35)'
        userMarkerRef.current = new markerLib.AdvancedMarkerElement({
          position: { lat: userLat, lng: userLng },
          map,
          content: dot,
          zIndex: 9999,
          title: 'موقعك',
        })
      } else {
        userMarkerRef.current = new markerLib.Marker({
          position: { lat: userLat, lng: userLng },
          map,
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
      }
    })
  }, [userLat, userLng, mapReady])

  return (
    <div
      ref={containerRef}
      className="rosera-google-map-root z-0 min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '100%',
        position: 'relative',
        touchAction: 'pan-x pan-y',
      }}
    />
  )
}

export const GoogleMapView = memo(GoogleMapViewInner, (prev, next) => {
  return (
    prev.markerStore === next.markerStore &&
    prev.centerLat === next.centerLat &&
    prev.centerLng === next.centerLng &&
    prev.zoom === next.zoom &&
    prev.bottomPaddingPx === next.bottomPaddingPx &&
    prev.leftPaddingPx === next.leftPaddingPx &&
    prev.rightPaddingPx === next.rightPaddingPx &&
    prev.highlightMarkerId === next.highlightMarkerId &&
    prev.userPosition?.[0] === next.userPosition?.[0] &&
    prev.userPosition?.[1] === next.userPosition?.[1] &&
    prev.onMarkerClick === next.onMarkerClick &&
    prev.onMapIdleSettled === next.onMapIdleSettled &&
    prev.mapInstanceRef === next.mapInstanceRef &&
    prev.onViewportBoundsIdle === next.onViewportBoundsIdle
  )
})
