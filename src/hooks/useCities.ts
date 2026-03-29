import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase, type SaRegionRow } from '@/lib/supabase'
import { toast } from 'sonner'
import { tr, type Lang } from '@/lib/i18n'
import { resolveSaudiRegionImage } from '@/lib/saRegionImages'

export type RegionCityRow = { id: string; name_ar: string; salonCount: number }

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

/** Region city list — `sa_regions` / `sa_cities` only (not legacy `public.cities`). */
export function useCities(regionId: string | undefined, lang: Lang) {
  const [regionName, setRegionName] = useState('')
  const [regionImage, setRegionImage] = useState('')
  const [cities, setCities] = useState<RegionCityRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!regionId) {
      setRegionName('')
      setRegionImage('')
      setCities([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)

      if (!isSupabaseConfigured) {
        if (!cancelled) {
          setCities([])
          toast.error(tr(lang, 'region.citiesLoadError'))
          setLoading(false)
        }
        return
      }

      try {
        const full = await withTimeout(
          supabase
            .from('sa_regions')
            .select(
              `
            name_ar,
            image_url,
            sa_cities (
              id,
              name_ar,
              businesses ( id )
            )
          `
            )
            .eq('id', regionId)
            .single(),
          FETCH_TIMEOUT_MS,
          'sa_regions region cities nested'
        )

        let r: SaRegionRow
        if (full.error) {
          const simple = await withTimeout(
            supabase
              .from('sa_regions')
              .select(
                `
              name_ar,
              image_url,
              sa_cities ( id, name_ar )
            `
              )
              .eq('id', regionId)
              .single(),
            FETCH_TIMEOUT_MS,
            'sa_regions region cities simple'
          )
          if (simple.error) throw simple.error
          r = simple.data as SaRegionRow
          if (!cancelled) {
            setRegionName(r.name_ar)
            setRegionImage(resolveSaudiRegionImage(r.name_ar, r.image_url))
            const list = (r.sa_cities ?? [])
              .map((city) => ({
                id: city.id,
                name_ar: city.name_ar,
                salonCount: 0,
              }))
              .sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'))
            setCities(list)
          }
          return
        }

        r = full.data as SaRegionRow
        if (!cancelled) {
          setRegionName(r.name_ar)
          setRegionImage(resolveSaudiRegionImage(r.name_ar, r.image_url))
          const list = (r.sa_cities ?? [])
            .map((city) => ({
              id: city.id,
              name_ar: city.name_ar,
              salonCount: city.businesses?.length ?? 0,
            }))
            .sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'))
          setCities(list)
        }
      } catch {
        if (!cancelled) {
          toast.error(tr(lang, 'region.citiesLoadError'))
          setCities([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [regionId, lang])

  return { regionName, regionImage, cities, loading }
}
