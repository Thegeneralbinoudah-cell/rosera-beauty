import { useEffect, useState, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react'
import { supabase, type Business } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { BusinessCard } from '@/components/business/BusinessCard'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { haversineKm } from '@/lib/utils'
import { toast } from 'sonner'

type BizRow = Business & {
  sa_cities?: { name_ar: string; sa_regions?: { name_ar: string } | null } | null
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') || '')
  const [list, setList] = useState<BizRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)
  const [cityF, setCityF] = useState(params.get('city') || '')
  const categoryLabelF = params.get('categoryLabel') || ''
  const [catLabelLocal, setCatLabelLocal] = useState(categoryLabelF)
  const [minRating, setMinRating] = useState('0')
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    setCatLabelLocal(categoryLabelF)
  }, [categoryLabelF])

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    )
  }, [])

  useEffect(() => {
    let c = true
    async function load() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('businesses')
          .select(
            `
            *,
            sa_cities ( name_ar, sa_regions ( name_ar ) )
          `
          )
          .eq('is_active', true)
        if (error) throw error
        if (!c) return
        setList((data ?? []) as BizRow[])
      } catch {
        if (c) toast.error('فشل البحث')
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [])

  const filtered = useMemo(() => {
    let r = list
    const qq = q.trim()
    if (qq) {
      r = r.filter((b) => {
        const regName = b.sa_cities?.sa_regions?.name_ar ?? b.region ?? ''
        const cityN = b.sa_cities?.name_ar ?? b.city
        const hay = `${b.name_ar} ${cityN} ${regName} ${b.category_label ?? ''} ${b.description_ar ?? ''}`
        return hay.includes(qq)
      })
    }
    if (cityF.trim()) {
      r = r.filter((b) => (b.city === cityF || b.sa_cities?.name_ar === cityF))
    }
    if (catLabelLocal.trim()) {
      r = r.filter((b) => (b.category_label ?? '').includes(catLabelLocal) || (b.category_label === catLabelLocal))
    }
    const mr = parseFloat(minRating)
    if (mr > 0) r = r.filter((b) => (b.average_rating ?? 0) >= mr)
    return r
  }, [list, q, cityF, catLabelLocal, minRating])

  const withDist = useMemo(() => {
    if (!userPos) return filtered.map((b) => ({ b, km: undefined as number | undefined }))
    return filtered.map((b) => ({
      b,
      km:
        b.latitude && b.longitude
          ? haversineKm(userPos.lat, userPos.lng, b.latitude, b.longitude)
          : undefined,
    }))
  }, [filtered, userPos])

  const applyCategoryFromHome = () => {
    const p = new URLSearchParams(params)
    if (catLabelLocal) p.set('categoryLabel', catLabelLocal)
    else p.delete('categoryLabel')
    setParams(p)
    setFilterOpen(false)
  }

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <div className="sticky top-0 z-20 border-b border-primary/10 bg-gradient-to-b from-white to-[#fff5fb] px-4 py-3 dark:from-card dark:to-rosera-dark">
        <div className="relative mx-auto max-w-lg">
          <SearchIcon className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9C27B0]" />
          <Input
            className="h-12 rounded-2xl border-primary/15 ps-10 shadow-sm"
            placeholder="صالون، مدينة، منطقة، تصنيف..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mx-auto mt-3 flex max-w-lg items-center justify-between gap-2">
          <Button variant="outline" size="sm" className="gap-1 rounded-full border-primary/20" onClick={() => setFilterOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            تصفية
          </Button>
          <Link to="/" className="text-sm font-bold text-primary">
            المناطق
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-4">
        {categoryLabelF && (
          <p className="mb-3 text-sm text-rosera-gray">
            التصنيف: <strong className="text-foreground">{categoryLabelF}</strong>
          </p>
        )}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-lg text-rosera-gray">لم نجد نتائج — جرّبي كلمات أخرى</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {withDist.map(({ b, km }) => (
              <BusinessCard key={b.id} b={b} distanceKm={km} showFavorite />
            ))}
          </div>
        )}
      </div>

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تصفية النتائج</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>المدينة (اسم بالعربية)</Label>
              <Input className="mt-2 rounded-xl" value={cityF} onChange={(e) => setCityF(e.target.value)} placeholder="مثال: الرياض" />
            </div>
            <div>
              <Label>التصنيف</Label>
              <Select value={catLabelLocal || 'all'} onValueChange={(v) => setCatLabelLocal(v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="صالون نسائي">صالون نسائي</SelectItem>
                  <SelectItem value="سبا ومساج">سبا ومساج</SelectItem>
                  <SelectItem value="مكياج">مكياج</SelectItem>
                  <SelectItem value="أظافر">أظافر</SelectItem>
                  <SelectItem value="عرائس">عرائس</SelectItem>
                  <SelectItem value="عناية بالبشرة">عناية بالبشرة</SelectItem>
                  <SelectItem value="حلاقة أطفال">حلاقة أطفال</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الحد الأدنى للتقييم</Label>
              <Select value={minRating} onValueChange={setMinRating}>
                <SelectTrigger className="mt-2 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">أي تقييم</SelectItem>
                  <SelectItem value="4">4+</SelectItem>
                  <SelectItem value="4.5">4.5+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={applyCategoryFromHome}>
              تطبيق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
