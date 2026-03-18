import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, Search } from 'lucide-react'
import { supabase, type SaRegionRow } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const CATEGORY_CHIPS: { label: string; q: string }[] = [
  { label: 'صالون نسائي', q: 'صالون نسائي' },
  { label: 'سبا ومساج', q: 'سبا ومساج' },
  { label: 'مكياج', q: 'مكياج' },
  { label: 'أظافر', q: 'أظافر' },
  { label: 'عرائس', q: 'عرائس' },
  { label: 'عناية بالبشرة', q: 'عناية بالبشرة' },
  { label: 'حلاقة أطفال', q: 'حلاقة أطفال' },
]

type RegionStats = {
  id: string
  name_ar: string
  image_url: string
  citiesWithSalons: number
  salonCount: number
}

export default function Home() {
  const { profile, user } = useAuth()
  const nav = useNavigate()
  const [regions, setRegions] = useState<RegionStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase
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
              businesses ( id )
            )
          `
          )
          .order('sort_order', { ascending: true })

        if (error) throw error
        const rows = (data ?? []) as SaRegionRow[]
        const stats: RegionStats[] = rows.map((r) => {
          const cities = r.sa_cities ?? []
          const withSalon = cities.filter((c) => (c.businesses?.length ?? 0) > 0)
          const salonCount = withSalon.reduce((acc, c) => acc + (c.businesses?.length ?? 0), 0)
          return {
            id: r.id,
            name_ar: r.name_ar,
            image_url: r.image_url,
            citiesWithSalons: withSalon.length,
            salonCount,
          }
        })
        if (!cancelled) setRegions(stats)
      } catch {
        if (!cancelled) toast.error('تعذر تحميل المناطق — تأكدي من تشغيل migrations والبذرة')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const name = profile?.full_name?.split(' ')[0] || (user ? 'جميلتي' : 'ضيفتنا')

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-30 border-b border-primary/10 bg-gradient-to-b from-white via-[#fff5fb] to-white/95 px-4 py-4 backdrop-blur-md dark:from-rosera-dark dark:via-rosera-dark">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <div>
            <p className="text-sm text-rosera-gray">أهلاً</p>
            <h1 className="text-xl font-extrabold text-foreground">{name} 👋</h1>
          </div>
          <Link
            to="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-[#9C27B0]/15 shadow-sm"
          >
            <Bell className="h-5 w-5 text-primary" />
            <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-[#E91E8C]" />
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-lg px-4 pt-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#9C27B0] via-[#E91E8C] to-[#f48fb1] px-6 py-8 text-center text-white shadow-[0_16px_48px_-12px_rgba(233,30,140,0.45)]">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.06\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
          <p className="relative text-sm font-medium text-white/95">روزيرا — جمالكِ يبدأ هنا</p>
          <h2 className="relative mt-2 text-2xl font-extrabold leading-tight">اخترين منطقتكِ ثم مدينتكِ</h2>
          <button
            type="button"
            onClick={() => nav('/search')}
            className="relative mt-6 flex w-full items-center gap-3 rounded-2xl bg-white/95 px-4 py-4 text-start shadow-lg"
          >
            <Search className="h-6 w-6 shrink-0 text-[#E91E8C]" />
            <span className="text-rosera-gray">ابحثي عن صالون، مدينة، منطقة، أو تصنيف...</span>
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-lg px-4 py-6">
        <h2 className="mb-4 text-lg font-extrabold text-foreground">التصنيفات</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {CATEGORY_CHIPS.map(({ label, q }) => (
            <motion.button
              key={label}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => nav(`/search?categoryLabel=${encodeURIComponent(q)}`)}
              className="shrink-0 rounded-full border border-primary/20 bg-gradient-to-br from-white to-[#fce4ec]/80 px-5 py-2.5 text-sm font-bold text-foreground shadow-sm dark:from-card dark:to-card"
            >
              {label}
            </motion.button>
          ))}
        </div>

        <section className="mt-10">
          <Link
            to="/store"
            className="flex items-center justify-between rounded-2xl border border-primary/15 bg-gradient-to-l from-white to-[#fce4ec]/50 p-4 shadow-sm dark:from-card dark:to-card"
          >
            <span className="text-lg font-extrabold">متجر الجمال 🛍️</span>
            <span className="text-primary font-bold">تسوقي ←</span>
          </Link>
        </section>

        <h2 className="mb-4 mt-10 text-lg font-extrabold">المناطق</h2>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {regions.map((reg, i) => (
              <motion.div
                key={reg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  to={`/region/${reg.id}`}
                  className="group relative block aspect-[16/10] overflow-hidden rounded-3xl shadow-[0_12px_40px_-8px_rgba(156,39,176,0.25)] ring-1 ring-black/5 transition hover:scale-[1.02] hover:shadow-xl"
                >
                  <img
                    src={reg.image_url}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
                  <div className="absolute bottom-0 start-0 end-0 p-4 text-white">
                    <h3 className="text-lg font-extrabold leading-tight drop-shadow-md">{reg.name_ar}</h3>
                    <p className="mt-1 text-xs font-medium text-white/90">
                      {reg.citiesWithSalons} مدينة · {reg.salonCount} صالون
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <Link
        to="/chat"
        className="fixed bottom-24 end-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#9C27B0] to-[#E91E8C] text-white shadow-lg"
        aria-label="روزيرا الذكية"
      >
        <span className="text-xl font-extrabold">ر</span>
      </Link>
    </div>
  )
}
