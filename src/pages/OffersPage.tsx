import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

type Offer = {
  id: string
  title?: string | null
  title_ar: string
  discount_percentage: number
  original_price: number
  offer_price: number
  end_date: string
  image?: string
  businesses: { id: string; name_ar: string; cover_image?: string }
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
          .select('*, businesses(id, name_ar, cover_image, category)')
          .eq('is_active', true)
        if (error) throw error
        let o = (data ?? []) as Offer[]
        if (filter === 'salon') o = o.filter((x) => (x.businesses as { category?: string }).category === 'salon')
        if (filter === 'clinic') o = o.filter((x) => (x.businesses as { category?: string }).category === 'clinic')
        if (filter === 'spa') o = o.filter((x) => (x.businesses as { category?: string }).category === 'spa')
        if (c) setList(filter === 'all' ? ((data ?? []) as Offer[]) : o)
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
            className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-95 ${filter === x.k ? 'gradient-rosera shadow-sm' : 'bg-white text-[#374151] ring-1 ring-[#E5E7EB] dark:bg-card dark:text-foreground'}`}
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
                  <span className="mt-1 w-fit rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
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
