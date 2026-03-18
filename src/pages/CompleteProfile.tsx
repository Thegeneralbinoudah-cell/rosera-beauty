import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { SaRegionRow } from '@/lib/supabase'

type CityOption = { id: string; name_ar: string; regionName: string }

export default function CompleteProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [city, setCity] = useState(profile?.city || '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(profile?.avatar_url || null)
  const [citiesByRegion, setCitiesByRegion] = useState<CityOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      nav('/auth', { replace: true })
      return
    }
    if (profile?.full_name?.trim()) {
      nav('/home', { replace: true })
      return
    }
    setFullName(profile?.full_name || '')
    setCity(profile?.city || 'الرياض')
    setAvatarPreview(profile?.avatar_url || null)
  }, [user, profile, nav])

  useEffect(() => {
    let c = true
    supabase
      .from('sa_regions')
      .select('id, name_ar, sa_cities(id, name_ar)')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        if (!c || !data) return
        const options: CityOption[] = []
        ;(data as SaRegionRow[]).forEach((r) => {
          const regionName = r.name_ar
          const cities = (r as { sa_cities?: { id: string; name_ar: string }[] }).sa_cities || []
          cities.forEach((city) => {
            options.push({ id: city.id, name_ar: city.name_ar, regionName })
          })
        })
        setCitiesByRegion(options)
        if (options.length && !city) setCity(options[0].name_ar)
      })
    return () => { c = false }
  }, [])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f?.type.startsWith('image/')) return
    setAvatarFile(f)
    setAvatarPreview(URL.createObjectURL(f))
  }

  const save = async () => {
    if (!user) return
    const name = fullName.trim()
    if (!name) {
      toast.error('أدخلي الاسم')
      return
    }
    setLoading(true)
    try {
      let avatarUrl = profile?.avatar_url || null
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop() || 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('avatars').upload(path, avatarFile, { upsert: true })
        if (!upErr) {
          const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path)
          avatarUrl = pub.publicUrl
        }
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: name,
          city: city || 'الرياض',
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast.success('تم الحفظ')
      nav('/home', { replace: true })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null
  if (profile?.full_name?.trim()) return null

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#fdf2f8] to-white px-6 py-12 dark:from-rosera-dark dark:to-rosera-dark">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-extrabold text-center text-foreground">أكملي ملفكِ</h1>
        <p className="mt-2 text-center text-sm text-rosera-gray">خطوة واحدة وتنتهين</p>

        <div className="mt-10 flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-primary/30 bg-primary/10 shadow-lg"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl font-bold text-primary">{(fullName || 'ر')[0]}</span>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition">
              <Camera className="h-10 w-10 text-white" />
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <Label>الاسم الكامل</Label>
            <Input
              className="mt-2 rounded-2xl"
              placeholder="أدخلي اسمكِ"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <Label>المدينة</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="mt-2 rounded-2xl">
                <SelectValue placeholder="اخترين المدينة" />
              </SelectTrigger>
              <SelectContent>
                {citiesByRegion.map((c) => (
                  <SelectItem key={c.id} value={c.name_ar}>
                    {c.name_ar} — {c.regionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="mt-6 h-12 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-base font-bold"
            onClick={save}
            disabled={loading}
          >
            حفظ
          </Button>
        </div>
      </div>
    </div>
  )
}
