import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function OwnerServices() {
  const { user } = useAuth()
  const [bid, setBid] = useState<string | null>(null)
  const [services, setServices] = useState<{ id: string; name_ar: string; price: number }[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')

  useEffect(() => {
    if (!user) return
    void supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBid(data?.id ?? null)
        if (data?.id)
          void supabase.from('services').select('id, name_ar, price').eq('business_id', data.id).then(({ data: s }) => setServices((s ?? []) as typeof services))
      })
  }, [user])

  const add = async () => {
    if (!bid || !name) return
    try {
      const { data, error } = await supabase
        .from('services')
        .insert({ business_id: bid, name_ar: name, price: parseFloat(price) || 0, duration_minutes: 30, category: 'hair' })
        .select()
        .single()
      if (error) throw error
      setServices((s) => [...s, data as { id: string; name_ar: string; price: number }])
      setName('')
      setPrice('')
      toast.success('أُضيفت الخدمة')
    } catch {
      toast.error('فشل — تأكدي من ربط منشأة بحسابك')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">إدارة الخدمات</h1>
      <div className="mt-6 flex flex-wrap gap-2 rounded-xl border bg-white p-4 dark:bg-card">
        <Input placeholder="اسم الخدمة" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <Input placeholder="السعر" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" />
        <Button onClick={add}>إضافة</Button>
      </div>
      <ul className="mt-6 space-y-2">
        {services.map((s) => (
          <li key={s.id} className="flex justify-between rounded-xl border bg-white p-4 dark:bg-card">
            <span>{s.name_ar}</span>
            <span className="font-bold text-primary">{s.price} ر.س</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
