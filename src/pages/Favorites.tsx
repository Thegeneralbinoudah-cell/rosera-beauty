import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, type Business } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { BusinessCard } from '@/components/business/BusinessCard'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { EmptyState } from '@/components/ui/empty-state'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'
import { fetchActiveSalonFeaturedAdSalonIds, partitionSalonsWithFeaturedAdsFirst } from '@/lib/salonAds'

export default function Favorites() {
  const { t } = useI18n()
  const { user } = useAuth()
  const nav = useNavigate()
  const [list, setList] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [featuredAdIds, setFeaturedAdIds] = useState<Set<string>>(new Set())

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

  useEffect(() => {
    if (!list.length) {
      setFeaturedAdIds(new Set())
      return
    }
    let c = true
    void fetchActiveSalonFeaturedAdSalonIds(list.map((b) => b.id)).then((s) => {
      if (c) setFeaturedAdIds(s)
    })
    return () => {
      c = false
    }
  }, [list])

  const orderedList = useMemo(
    () => partitionSalonsWithFeaturedAdsFirst(list, featuredAdIds),
    [list, featuredAdIds]
  )

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
      <div className="min-h-dvh bg-rosera-light px-4 py-6 dark:bg-rosera-dark">
        <h1 className="text-2xl font-bold">{t('favorites.title')}</h1>
        <div className="py-10">
          <EmptyState
            icon={Heart}
            title={t('favorites.emptyTitle')}
            subtitle={t('favorites.emptySub')}
            ctaLabel={t('favorites.emptyCta')}
            onClick={() => nav(buildMapExploreUrl())}
            analyticsSource="favorites"
          />
        </div>
      </div>
    )

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-6 dark:bg-rosera-dark">
      <h1 className="text-2xl font-bold">{t('favorites.title')}</h1>
      <div className="motion-stagger mt-6 grid gap-4 sm:grid-cols-2">
        {orderedList.map((b) => (
          <div key={b.id} className="relative">
            <BusinessCard b={b} isFeaturedAd={featuredAdIds.has(b.id)} />
            <button
              type="button"
              className="absolute top-2 end-2 flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-md"
              onClick={() => remove(b.id)}
              aria-label="إزالة"
            >
              <Heart className="h-6 w-6 fill-gold text-gold" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
