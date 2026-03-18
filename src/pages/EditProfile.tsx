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

export default function EditProfile() {
  const { user, profile, refreshProfile } = useAuth()
  const nav = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [citiesByRegion, setCitiesByRegion] = useState<CityOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      nav('/auth')
      return
    }
    setName(profile?.full_name || '')
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
          full_name: name.trim() || profile?.full_name,
          city: city || profile?.city,
          avatar_url: avatarUrl ?? profile?.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
      if (error) throw error
      await refreshProfile()
      toast.success('تم الحفظ')
      nav('/profile')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-8 pb-28 dark:bg-rosera-dark">
      <h1 className="text-2xl font-bold">تعديل الملف</h1>
      <div className="mx-auto mt-8 max-w-md space-y-4">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-primary/30 bg-primary/10"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-primary">{(name || profile?.full_name || 'ر')[0]}</span>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition">
              <Camera className="h-8 w-8 text-white" />
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
          <p className="mt-2 text-xs text-rosera-gray">اضغطي لتغيير الصورة</p>
        </div>
        <div>
          <Label>الاسم</Label>
          <Input className="mt-2 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label>المدينة</Label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="mt-2 rounded-xl">
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
        <Button className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={save} disabled={loading}>
          حفظ التغييرات
        </Button>
      </div>
    </div>
  )
}
