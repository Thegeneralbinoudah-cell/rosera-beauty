/**
 * Single source of truth for Google Maps JS API key:
 * - Vite `define` injects this as `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`
 * - `GoogleMapView` / Map page Places use this embedded key directly for stable loads.
 * - `getGoogleMapsApiKey()` still prefers env then falls back here for other call sites.
 */
export const GOOGLE_MAPS_API_KEY_EMBEDDED =
  'AIzaSyB744jBT2foi5YCM_04nBwEqmSpuai3WkA' as const
