import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase, type SaRegionRow } from '@/lib/supabase'
import { toast } from 'sonner'
import { tr, type Lang } from '@/lib/i18n'

export type RegionStats = {
  id: string
  name_ar: string
  image_url: string
  totalCities: number
  citiesWithSalons: number
  salonCount: number
}

const FETCH_TIMEOUT_MS = 18_000

function withTimeout<T>(promiseLike: PromiseLike<T>, ms: number, label: string): Promise<T> {
  const promise = Promise.resolve(promiseLike)
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([
    promise.finally(() => {
      if (timeoutId !== undefined) clearTimeout(timeoutId)
    }),
    timeoutPromise,
  ])
}

function mapRowsToStats(rows: SaRegionRow[], includeSalonStats: boolean): RegionStats[] {
  return rows.map((r) => {
    const cities = r.sa_cities ?? []
    if (!includeSalonStats) {
      return {
        id: r.id,
        name_ar: r.name_ar,
        image_url: r.image_url,
        totalCities: cities.length,
        citiesWithSalons: 0,
        salonCount: 0,
      }
    }
    const realBiz = (b: { is_demo?: boolean }) => !b.is_demo
    const withSalon = cities.filter((c) => (c.businesses ?? []).filter(realBiz).length > 0)
    const salonCount = withSalon.reduce(
      (acc, c) => acc + (c.businesses ?? []).filter(realBiz).length,
      0
    )
    return {
      id: r.id,
      name_ar: r.name_ar,
      image_url: r.image_url,
      totalCities: cities.length,
      citiesWithSalons: withSalon.length,
      salonCount,
    }
  })
}

/**
 * Home — loads `sa_regions` + nested `sa_cities` only (not legacy `public.cities`).
 * Uses a timeout so the UI cannot stay on the skeleton indefinitely if the network hangs.
 */
export function useRegions(lang: Lang) {
  const [regions, setRegions] = useState<RegionStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)

      if (!isSupabaseConfigured) {
        console.warn('[useRegions] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — check .env / vite merge')
        if (!cancelled) {
          setRegions([])
          toast.error(tr(lang, 'home.regionsLoadError'))
          setLoading(false)
        }
        return
      }

      try {
        const nested = await withTimeout(
          supabase
            .from('sa_regions')
            .select(
              `
            id,
            name_ar,
            capital_ar,
            image_url,
            sort_order,
            sa_cities (
              id,
              name_ar,
              businesses ( id, is_demo )
            )
          `
            )
            .order('sort_order', { ascending: true }),
          FETCH_TIMEOUT_MS,
          'sa_regions nested'
        )

        let rows: SaRegionRow[] = []

        if (nested.error) {
          console.warn('[useRegions] nested query failed, falling back without businesses:', nested.error)
          const simple = await withTimeout(
            supabase
              .from('sa_regions')
              .select(
                `
              id,
              name_ar,
              capital_ar,
              image_url,
              sort_order,
              sa_cities ( id, name_ar )
            `
              )
              .order('sort_order', { ascending: true }),
            FETCH_TIMEOUT_MS,
            'sa_regions simple'
          )
          if (simple.error) throw simple.error
          rows = (simple.data ?? []) as SaRegionRow[]
          if (!cancelled) setRegions(mapRowsToStats(rows, false))
          return
        }

        rows = (nested.data ?? []) as SaRegionRow[]
        if (!cancelled) setRegions(mapRowsToStats(rows, true))
      } catch (e) {
        console.error('[useRegions] load regions', e)
        if (!cancelled) {
          setRegions([])
          toast.error(tr(lang, 'home.regionsLoadError'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [lang])

  return { regions, loading }
}
