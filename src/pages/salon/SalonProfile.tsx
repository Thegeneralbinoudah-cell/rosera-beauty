import { useEffect, useState } from 'react'
import { supabase, type Business } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId } from '@/lib/salonOwner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function SalonProfile() {
  const { user } = useAuth()
  const [bid, setBid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name_ar, setNameAr] = useState('')
  const [description_ar, setDescriptionAr] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [address_ar, setAddressAr] = useState('')
  const [category_label, setCategoryLabel] = useState('')

  useEffect(() => {
    if (!user) return
    void getMySalonBusinessId(user.id).then(setBid)
  }, [user])

  useEffect(() => {
    if (!bid) {
      setLoading(false)
      return
    }
    let c = true
    void supabase
      .from('businesses')
      .select('name_ar, description_ar, phone, whatsapp, address_ar, category_label')
      .eq('id', bid)
      .single()
      .then(({ data, error }) => {
        if (!c) return
        if (error || !data) {
          toast.error('تعذر تحميل بيانات الصالون')
          setLoading(false)
          return
        }
        const b = data as Pick<
          Business,
          'name_ar' | 'description_ar' | 'phone' | 'whatsapp' | 'address_ar' | 'category_label'
        >
        setNameAr(b.name_ar ?? '')
        setDescriptionAr(b.description_ar ?? '')
        setPhone(b.phone ?? '')
        setWhatsapp(b.whatsapp ?? '')
        setAddressAr(b.address_ar ?? '')
        setCategoryLabel(b.category_label ?? '')
        setLoading(false)
      })
    return () => {
      c = false
    }
  }, [bid])

  const save = async () => {
    if (!bid || !name_ar.trim()) {
      toast.error('اسم الصالون مطلوب')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name_ar: name_ar.trim(),
          description_ar: description_ar.trim() || null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          address_ar: address_ar.trim() || null,
          category_label: category_label.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bid)
      if (error) throw error
      toast.success('تم حفظ ملف الصالون')
    } catch {
      toast.error('تعذر الحفظ — تحققي من صلاحيات الحساب')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        جاري التحميل…
      </div>
    )
  }

  if (!bid) {
    return (
      <Card className="border-pink-100/80 p-6 text-center dark:border-border">
        <p className="font-semibold">لا يوجد صالون مرتبط بهذا الحساب</p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-[#880e4f] dark:text-[#f48fb1]">ملف الصالون</h1>
        <p className="mt-1 text-sm text-muted-foreground">البيانات الظاهرة لعملائك في التطبيق</p>
      </div>

      <Card className="space-y-4 border-pink-100/80 p-4 dark:border-border">
        <div className="space-y-2">
          <Label htmlFor="sn">اسم الصالون</Label>
          <Input id="sn" value={name_ar} onChange={(e) => setNameAr(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sd">الوصف</Label>
          <Input id="sd" value={description_ar} onChange={(e) => setDescriptionAr(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sl">تصنيف العرض (عربي)</Label>
          <Input
            id="sl"
            placeholder="مثال: صالون نسائي"
            value={category_label}
            onChange={(e) => setCategoryLabel(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sp">الهاتف</Label>
            <Input id="sp" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sw">واتساب</Label>
            <Input id="sw" dir="ltr" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="rounded-xl" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="sa">العنوان</Label>
          <Input id="sa" value={address_ar} onChange={(e) => setAddressAr(e.target.value)} className="rounded-xl" />
        </div>
        <Button
          className="w-full rounded-xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? 'جاري الحفظ…' : 'حفظ التغييرات'}
        </Button>
      </Card>
    </div>
  )
}
