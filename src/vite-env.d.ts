/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Google Maps JavaScript API + Places API (New) — same key with APIs enabled in Cloud Console */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_MOYASAR_PUBLISHABLE_KEY?: string
  /** Stripe.js publishable key — تفعّل صفحة اشتراك الصالون عبر Stripe (بطاقة + Apple Pay في Payment Element) */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_PAYMENT_MODE?: string
  /** ElevenLabs — يُعرَض للعميل؛ يُفضّل بروكسي من الخادم في الإنتاج */
  readonly VITE_ELEVENLABS_API_KEY?: string
  /** معرّف صوت أنثوي (مثال افتراضي: Bella) */
  readonly VITE_ELEVENLABS_VOICE_ID?: string
  /** اختياري: صوت منفصل لوضع مبيعات مالكة الصالون (الافتراضي: Bella) */
  readonly VITE_ELEVENLABS_SALES_VOICE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
