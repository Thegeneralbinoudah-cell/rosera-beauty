import { useEffect, useState } from 'react'
import { Star, MapPin, Heart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Business } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

export function BusinessCard({
  b,
  className,
  distanceKm,
  showFavorite,
}: {
  b: Business
  className?: string
  distanceKm?: number
  showFavorite?: boolean
}) {
  const { user } = useAuth()
  const nav = useNavigate()
  const img = b.cover_image || b.images?.[0] || ''
  const label = b.category_label || b.category
  const [fav, setFav] = useState(false)

  useEffect(() => {
    if (!user || !showFavorite) return
    let cancelled = false
    void supabase
      .from('favorites')
      .select('id')
      .eq('business_id', b.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setFav(!!data)
      })
    return () => {
      cancelled = true
    }
  }, [user, b.id, showFavorite])

  const toggleFav = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      toast.error('سجّلي دخولكِ لإضافة المفضلة')
      nav('/auth')
      return
    }
    try {
      if (fav) {
        await supabase.from('favorites').delete().eq('business_id', b.id).eq('user_id', user.id)
        setFav(false)
        toast.success('أُزيلت من المفضلة')
      } else {
        await supabase.from('favorites').insert({ business_id: b.id, user_id: user.id })
        setFav(true)
        toast.success('أُضيفت للمفضلة')
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={() => nav(`/salon/${b.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          nav(`/salon/${b.id}`)
        }
      }}
      className={cn(
        'cursor-pointer overflow-hidden transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img src={img} alt="" className="h-full w-full object-cover" />
        <Badge className="absolute top-2 start-2 max-w-[85%] truncate text-[10px] font-semibold shadow-md">
          {label}
        </Badge>
        {showFavorite && (
          <button
            type="button"
            aria-label="مفضلة"
            className="absolute top-2 end-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition hover:scale-105 dark:bg-black/50"
            onClick={toggleFav}
          >
            <Heart
              className={cn('h-5 w-5', fav ? 'fill-[#E91E8C] text-[#E91E8C]' : 'text-rosera-gray')}
            />
          </button>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-base font-semibold text-[#1F1F1F] dark:text-foreground">{b.name_ar}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-[#374151] dark:text-rosera-gray">
          <span className="flex items-center gap-0.5 text-[#9B2257]">
            <Star className="h-4 w-4 fill-[#9B2257] text-[#9B2257]" />
            {Number(b.average_rating ?? 0).toFixed(1)}
          </span>
          <span>({b.total_reviews ?? 0})</span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {b.city}
          </span>
          {distanceKm != null && <span>{distanceKm.toFixed(1)} كم</span>}
        </div>
      </div>
    </Card>
  )
}

export function BusinessRow({ b }: { b: Business }) {
  const nav = useNavigate()
  const img = b.cover_image || b.images?.[0] || ''
  return (
    <button
      type="button"
      onClick={() => nav(`/salon/${b.id}`)}
      className="flex w-full gap-3 rounded-2xl border border-primary/10 bg-white p-3 text-start shadow-sm dark:bg-card"
    >
      <img src={img} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-semibold text-[#1F1F1F] dark:text-foreground">{b.name_ar}</h3>
        <p className="text-sm font-medium text-[#374151] dark:text-rosera-gray">{b.city}</p>
        <div className="mt-1 flex items-center gap-1 text-sm font-medium text-[#9B2257]">
          <Star className="h-4 w-4 fill-[#9B2257] text-[#9B2257]" />
          {Number(b.average_rating ?? 0).toFixed(1)}
        </div>
      </div>
    </button>
  )
}
