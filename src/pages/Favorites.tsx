import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, type Business } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { BusinessCard } from '@/components/business/BusinessCard'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'

export default function Favorites() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [list, setList] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      nav('/auth')
      return
    }
    const uid = user.id
    let c = true
    async function load() {
      try {
        const { data, error } = await supabase
          .from('favorites')
          .select('business_id, businesses(*)')
          .eq('user_id', uid)
        if (error) throw error
        const biz = (data ?? [])
          .map((x: { businesses: Business | Business[] }) => (Array.isArray(x.businesses) ? x.businesses[0] : x.businesses))
          .filter(Boolean) as Business[]
        if (c) setList(biz)
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
  }, [user, nav])

  const remove = async (bid: string) => {
    if (!user) return
    try {
      await supabase.from('favorites').delete().eq('user_id', user.id).eq('business_id', bid)
      setList((l) => l.filter((b) => b.id !== bid))
      toast.success('أُزيلت')
    } catch {
      toast.error('فشل')
    }
  }

  if (!user) return null
  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>

  if (list.length === 0)
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4 text-center">
        <Heart className="h-16 w-16 text-rosera-gray/40" />
        <p className="mt-4 text-lg text-rosera-gray">لم تضيفي أي مفضلة بعد ❤️</p>
      </div>
    )

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-6 dark:bg-rosera-dark">
      <h1 className="text-2xl font-bold">المفضلة</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {list.map((b) => (
          <div key={b.id} className="relative">
            <BusinessCard b={b} />
            <button
              type="button"
              className="absolute top-2 end-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md"
              onClick={() => remove(b.id)}
              aria-label="إزالة"
            >
              <Heart className="h-6 w-6 fill-accent text-accent" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
