import { buildMapMarkersSignature, type MapMarkerRow } from '@/lib/mapMarkers'

/**
 * Minimal external store for map markers — filter UI can setState freely without
 * forcing the map host to take new `markers` props every time (stable snapshot).
 * React 18: pair with useSyncExternalStore in the map widget only.
 */
export type MapMarkerSnapshot = { signature: string; markers: MapMarkerRow[] }

export function createMapMarkerStore() {
  let state: MapMarkerSnapshot = { signature: '', markers: [] }
  const listeners = new Set<() => void>()

  return {
    subscribe(cb: () => void) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
    getSnapshot: (): MapMarkerSnapshot => state,
    /** Idempotent when signature unchanged — avoids useless map marker rebuilds. */
    setMarkers(markers: MapMarkerRow[], signature: string) {
      if (signature === state.signature) return
      state = { signature, markers }
      for (const l of listeners) l()
    },
    /** Convenience: signature derived from rows (same as MapPage pipeline). */
    applyMarkerRows(markers: MapMarkerRow[]) {
      this.setMarkers(markers, buildMapMarkersSignature(markers))
    },
  }
}

export type MapMarkerStore = ReturnType<typeof createMapMarkerStore>
