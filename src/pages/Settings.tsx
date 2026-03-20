import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { STORAGE_KEYS } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { usePreferences } from '@/contexts/PreferencesContext'

export default function Settings() {
  const { dark, setDark, lang, setLang } = usePreferences()
  const [city, setCity] = useState('الخبر')
  const [notif, setNotif] = useState(true)
  const [delOpen, setDelOpen] = useState(false)

  useEffect(() => {
    setCity(localStorage.getItem(STORAGE_KEYS.city) || 'الخبر')
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.lang, lang)
    localStorage.setItem(STORAGE_KEYS.city, city)
  }, [lang, city])

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-8 dark:bg-rosera-dark">
      <h1 className="text-2xl font-bold">الإعدادات</h1>
      <div className="mx-auto mt-8 max-w-md space-y-6">
        <div className="flex items-center justify-between rounded-xl border bg-white p-4 dark:bg-card">
          <span>🌐 اللغة</span>
          <Select value={lang} onValueChange={(v) => setLang(v as 'ar' | 'en')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ar">عربي</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-xl border bg-white p-4 dark:bg-card">
          <span>🔔 الإشعارات</span>
          <Switch checked={notif} onCheckedChange={setNotif} />
        </div>
        <div className="flex items-center justify-between rounded-xl border bg-white p-4 dark:bg-card">
          <span>🌆 المدينة الافتراضية</span>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['الخبر', 'الرياض', 'جدة'].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-xl border bg-white p-4 dark:bg-card">
          <span>🌙 الوضع الداكن</span>
          <Switch checked={dark} onCheckedChange={setDark} />
        </div>
        <Link to="/privacy" className="block rounded-xl border bg-white p-4 dark:bg-card">
          📜 سياسة الخصوصية
        </Link>
        <Link to="/terms" className="block rounded-xl border bg-white p-4 dark:bg-card">
          📋 شروط الاستخدام
        </Link>
        <div className="rounded-xl border bg-white p-4 dark:bg-card">ℹ️ عن روزيرا — منصة حجز صالونات التجميل للسيدات في السعودية</div>
        <Button variant="destructive" className="w-full" onClick={() => setDelOpen(true)}>
          🗑️ حذف الحساب
        </Button>
      </div>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد حذف الحساب؟</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-rosera-gray">لا يمكن التراجع. تواصلي مع الدعم لحذف كامل.</p>
          <Button variant="destructive" onClick={() => { setDelOpen(false); toast.message('تواصلي معنا لإكمال الطلب') }}>
            تأكيد
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
