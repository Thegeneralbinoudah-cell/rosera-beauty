/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Legacy optional; OAuth uses `window.location.origin + '/auth/callback'` in code. */
  readonly VITE_AUTH_REDIRECT_URL?: string
  /** Google Maps JavaScript API + Places API (New) — same key with APIs enabled in Cloud Console */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  /** Optional Map ID for vector tiles + AdvancedMarkerElement (Map Management in Cloud Console) */
  readonly VITE_GOOGLE_MAPS_MAP_ID?: string
  readonly VITE_MOYASAR_PUBLISHABLE_KEY?: string
  /** Stripe.js publishable key — تفعّل صفحة اشتراك الصالون عبر Stripe (بطاقة + Apple Pay في Payment Element) */
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  readonly VITE_PAYMENT_MODE?: string
  /** ElevenLabs — يُعرَض للعميل؛ يُفضّل بروكسي من الخادم في الإنتاج */
  readonly VITE_ELEVENLABS_API_KEY?: string
  /**
   * معرّف الصوت المستنسخ لروزي. يُحقَن من `ELEVENLABS_VOICE_ID` في `.env` عندما يكون هذا فارغاً (vite.config).
   * عند التشغيل: أولاً `public.rosey_voice_config.voice_id` ثم هذا الحقل.
   */
  readonly VITE_ELEVENLABS_VOICE_ID?: string
  /** PostHog — مفتاح المشروع من لوحة app.posthog.com (اختياري؛ بدون مفتاح لا يُحمَّل التتبع) */
  readonly VITE_POSTHOG_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
