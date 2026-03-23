import { useEffect, useState } from 'react'
import { isSupabaseConfigured, supabase, type Business } from '@/lib/supabase'
import { toast } from 'sonner'
import { tr, type Lang } from '@/lib/i18n'
import { filterFemaleBeautyBusinesses } from '@/lib/roseraBusinessFilters'

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

/** CitySalons — resolves city via `sa_cities`; lists `businesses` by `city_id`. */
export function useCitySalons(cityId: string | undefined, lang: Lang) {
  const [cityName, setCityName] = useState('')
  const [regionId, setRegionId] = useState<string | null>(null)
  const [salons, setSalons] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cityId) {
      setCityName('')
      setRegionId(null)
      setSalons([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)

      if (!isSupabaseConfigured) {
        if (!cancelled) {
          toast.error(tr(lang, 'city.loadError'))
          setSalons([])
          setLoading(false)
        }
        return
      }

      try {
        const cityRes = await withTimeout(
          supabase.from('sa_cities').select('name_ar, region_id').eq('id', cityId).single(),
          FETCH_TIMEOUT_MS,
          'sa_cities single'
        )
        if (cityRes.error) throw cityRes.error
        const row = cityRes.data as { name_ar: string; region_id: string }
        if (!cancelled) {
          setCityName(row.name_ar)
          setRegionId(row.region_id)
        }

        const bizRes = await withTimeout(
          supabase
            .from('businesses')
            .select('*')
            .eq('city_id', cityId)
            .eq('is_active', true)
            .eq('is_demo', false),
          FETCH_TIMEOUT_MS,
          'businesses by city'
        )
        if (bizRes.error) throw bizRes.error
        if (!cancelled) {
          const raw = (bizRes.data ?? []) as Business[]
          setSalons(filterFemaleBeautyBusinesses(raw))
        }
      } catch {
        if (!cancelled) {
          toast.error(tr(lang, 'city.loadError'))
          setSalons([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [cityId, lang])

  return { cityName, regionId, salons, loading }
}
