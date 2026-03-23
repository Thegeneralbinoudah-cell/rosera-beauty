/**
 * Emergency fallback when `loadEnv` / parent `.env` merge fails in Vite.
 * Normally leave both empty — use `rosera/.env.local` or `ROSERA/.env.local`.
 * If needed locally, paste your Supabase project URL and anon JWT here (same as Dashboard → API).
 */
export const SUPABASE_URL_EMBEDDED = '' as const
export const SUPABASE_ANON_KEY_EMBEDDED = '' as const
