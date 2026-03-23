/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Google Maps JavaScript API + Places API (New) — same key with APIs enabled in Cloud Console */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_MOYASAR_PUBLISHABLE_KEY?: string
  readonly VITE_PAYMENT_MODE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
