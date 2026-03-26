import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, type Business } from '@/lib/supabase'
import { businessMatchesOffersVenueTab } from '@/lib/searchCategoryFilter'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Offer = {
  id: string
  title?: string | null
  title_ar: string
  discount_percentage: number
  original_price: number
  offer_price: number
  end_date: string
  image?: string
  businesses: Pick<Business, 'id' | 'name_ar' | 'cover_image' | 'category' | 'category_label'>
}

export default function OffersPage() {
  const nav = useNavigate()
  const [filter, setFilter] = useState('all')
  const [list, setList] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let c = true
    async function load() {
      try {
        const { data, error } = await supabase
          .from('offers')
          .select('*, businesses(id, name_ar, cover_image, category, category_label)')
          .eq('is_active', true)
        if (error) throw error
        const raw = (data ?? []) as Offer[]
        const tab = filter as 'all' | 'salon' | 'clinic' | 'spa'
        const o =
          tab === 'all'
            ? raw
            : raw.filter((x) => {
                const b = x.businesses
                if (!b) return false
                return businessMatchesOffersVenueTab(tab, b)
              })
        if (c) setList(o)
      } catch {
        toast.error('تعذر التحميل')
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [filter])

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-6 dark:bg-rosera-dark">
      <h1 className="text-2xl font-bold">العروض والخصومات 🔥</h1>
      <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { k: 'all', l: 'الكل' },
          { k: 'salon', l: 'صالونات' },
          { k: 'clinic', l: 'عيادات' },
          { k: 'spa', l: 'سبا' },
        ].map((x) => (
          <button
            key={x.k}
            type="button"
            onClick={() => {
              setLoading(true)
              setFilter(x.k)
            }}
            className={cn(
              'shrink-0 rounded-full border-2 px-4 py-2.5 text-sm font-bold transition-all duration-200 active:scale-95',
              filter === x.k
                ? 'border-foreground bg-foreground text-background shadow-sm'
                : 'border-foreground/20 bg-transparent text-foreground hover:border-foreground/35'
            )}
          >
            {x.l}
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        {loading
          ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full" />)
          : list.map((o) => (
              <div key={o.id} className="flex gap-4 overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-card">
                <img
                  src={o.image || o.businesses?.cover_image || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200'}
                  alt=""
                  className="h-36 w-32 shrink-0 object-cover"
                />
                <div className="flex flex-1 flex-col justify-center py-3 pe-3">
                  <p className="text-xs text-rosera-gray">{o.businesses?.name_ar}</p>
                  <h3 className="font-bold">{o.title?.trim() || o.title_ar || 'عرض خاص'}</h3>
                  <span className="mt-1 w-fit rounded-full bg-gold-subtle px-2 py-0.5 text-xs font-bold text-gold">
                    {o.discount_percentage}% خصم
                  </span>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="line-through text-rosera-gray">{o.original_price} ر.س</span>
                    <span className="text-lg font-extrabold text-primary">{o.offer_price} ر.س</span>
                  </div>
                  <p className="text-xs text-rosera-gray">حتى {o.end_date || '—'}</p>
                  <Button size="sm" className="mt-2 w-fit" onClick={() => nav(`/salon/${o.businesses?.id}`)}>
                    احجزي الآن
                  </Button>
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}
