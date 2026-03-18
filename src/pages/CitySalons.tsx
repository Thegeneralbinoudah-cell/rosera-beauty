import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, type Business } from '@/lib/supabase'
import { BusinessCard } from '@/components/business/BusinessCard'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function CitySalons() {
  const { cityId } = useParams()
  const [cityName, setCityName] = useState('')
  const [regionId, setRegionId] = useState<string | null>(null)
  const [salons, setSalons] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cityId) return
    let c = true
    async function load() {
      setLoading(true)
      try {
        const { data: cityRow, error: e0 } = await supabase
          .from('sa_cities')
          .select('name_ar, region_id')
          .eq('id', cityId)
          .single()
        if (e0) throw e0
        if (!c) return
        setCityName((cityRow as { name_ar: string; region_id: string }).name_ar)
        setRegionId((cityRow as { region_id: string }).region_id)

        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('city_id', cityId)
          .eq('is_active', true)
        if (error) throw error
        if (!c) return
        setSalons((data ?? []) as Business[])
      } catch {
        if (c) toast.error('تعذر تحميل الصالونات')
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [cityId])

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-20 border-b border-primary/10 bg-gradient-to-b from-[#fce4ec]/90 to-white px-4 py-4 backdrop-blur dark:from-rosera-dark dark:to-rosera-dark">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          {regionId && (
            <Link to={`/region/${regionId}`} className="text-sm font-bold text-primary">
              ← المنطقة
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold truncate">{cityName || '...'}</h1>
            <p className="text-sm text-rosera-gray">صالونات المدينة</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        ) : salons.length === 0 ? (
          <p className="py-16 text-center text-rosera-gray">لا صالونات مسجّلة في هذه المدينة بعد</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {salons.map((b) => (
              <BusinessCard key={b.id} b={b} showFavorite />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
