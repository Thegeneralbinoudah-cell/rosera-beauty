import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { supabase, type SaRegionRow } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export default function RegionCities() {
  const { regionId } = useParams()
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [cities, setCities] = useState<{ id: string; name_ar: string; salonCount: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!regionId) return
    let c = true
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase
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
          .single()

        if (error) throw error
        const r = data as SaRegionRow
        if (!c) return
        setName(r.name_ar)
        setImage(r.image_url)
        const list = (r.sa_cities ?? [])
          .map((city) => ({
            id: city.id,
            name_ar: city.name_ar,
            salonCount: city.businesses?.length ?? 0,
          }))
          .filter((x) => x.salonCount > 0)
          .sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'))
        setCities(list)
      } catch {
        if (c) toast.error('تعذر تحميل المدن')
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [regionId])

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <div className="relative h-44 overflow-hidden">
        {image && <img src={image} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-rosera-light dark:from-rosera-dark to-transparent" />
        <div className="absolute bottom-4 start-4 end-4">
          <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-white drop-shadow">
            الرئيسية
          </Link>
          <h1 className="text-2xl font-extrabold text-white drop-shadow-md">{name || '...'}</h1>
          <p className="mt-1 text-sm text-white/90">اخترين المدينة</p>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : cities.length === 0 ? (
          <p className="py-12 text-center text-rosera-gray">لا توجد مدن بصالونات في هذه المنطقة حالياً</p>
        ) : (
          <ul className="space-y-3">
            {cities.map((city, i) => (
              <motion.li
                key={city.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Link
                  to={`/city/${city.id}`}
                  className="flex items-center justify-between rounded-2xl border border-primary/10 bg-gradient-to-l from-white to-[#fce4ec]/40 p-4 shadow-sm transition hover:shadow-md dark:from-card dark:to-card"
                >
                  <div>
                    <p className="font-bold text-foreground">{city.name_ar}</p>
                    <p className="text-sm text-rosera-gray">
                      {city.salonCount} {city.salonCount === 1 ? 'صالون' : 'صالونات'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-primary rtl:rotate-180" />
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
