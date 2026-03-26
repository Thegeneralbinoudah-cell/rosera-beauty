import type { MutableRefObject } from 'react'
import { memo } from 'react'
import { GoogleMapView } from '@/components/map/GoogleMapView'
import type { Business } from '@/lib/supabase'
import type { MapMarkerStore } from '@/lib/mapMarkerStore'
import type { LatLngBoundsBox } from '@/lib/fetchSalonsInBounds'

export type MapPageMapProps = {
  centerLat: number
  centerLng: number
  zoom: number
  markerStore: MapMarkerStore
  mapInstanceRef?: MutableRefObject<google.maps.Map | null>
  /** Debounced (350ms) after map idle — viewport-based fetch in MapPage */
  onViewportBoundsIdle?: (bounds: LatLngBoundsBox) => void
  userPosition: [number, number] | null
  onMarkerClick: (b: Business, pos: [number, number]) => void
  highlightMarkerId?: string | null
  bottomPaddingPx: number
  leftPaddingPx?: number
  rightPaddingPx?: number
  onMapIdleSettled?: () => void
}

/** حزمة الخريطة تُحمَّل كسولاً من صفحة الخريطة لتقليل الحجم الأولي */
function MapPageMapInner(props: MapPageMapProps) {
  return <GoogleMapView {...props} />
}

export default memo(MapPageMapInner)
