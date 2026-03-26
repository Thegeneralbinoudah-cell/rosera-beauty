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
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { usePreferences } from '@/contexts/PreferencesContext'
import { tr } from '@/lib/i18n'

export default function Settings() {
  const { dark, setDark, lang, setLang } = usePreferences()
  const t = (key: string) => tr(lang, key)
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
    <div className="luxury-page-canvas px-4 py-8 pb-28">
      <div className="mx-auto max-w-md">
        <h1 className="text-heading-2 font-bold tracking-luxury-tight text-foreground">الإعدادات</h1>
        <p className="mt-2 text-body-sm font-medium text-muted-foreground">تفضيلاتكِ وتجربة التطبيق بأناقة</p>

        <div className="mt-10 space-y-4">
          <Card className="flex items-center justify-between gap-4 p-5 shadow-elevated">
            <span className="text-body font-medium text-foreground">🌐 اللغة</span>
            <Select value={lang} onValueChange={(v) => setLang(v as 'ar' | 'en')}>
              <SelectTrigger className="w-36 rounded-2xl border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">عربي</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </Card>

          <Card className="flex items-center justify-between gap-4 p-5 shadow-elevated">
            <span className="text-body font-medium text-foreground">🔔 الإشعارات</span>
            <Switch checked={notif} onCheckedChange={setNotif} />
          </Card>

          <Card className="flex items-center justify-between gap-4 p-5 shadow-elevated">
            <span className="text-body font-medium text-foreground">🌆 المدينة الافتراضية</span>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="w-32 rounded-2xl border-border/60">
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
          </Card>

          <Card className="flex items-center justify-between gap-4 p-5 shadow-elevated">
            <span className="text-body font-medium text-foreground">🌙 الوضع الداكن</span>
            <Switch checked={dark} onCheckedChange={setDark} />
          </Card>

          <Link
            to="/install"
            className="block rounded-3xl border border-border/50 bg-card p-5 text-body font-medium text-foreground shadow-elevated transition-all hover:border-primary/25 hover:shadow-floating"
          >
            📲 {t('pwa.settingsLink')}
          </Link>
          <Link
            to="/privacy"
            className="block rounded-3xl border border-border/50 bg-card p-5 text-body font-medium text-foreground shadow-elevated transition-all hover:border-primary/25 hover:shadow-floating"
          >
            📜 سياسة الخصوصية
          </Link>
          <Link
            to="/terms"
            className="block rounded-3xl border border-border/50 bg-card p-5 text-body font-medium text-foreground shadow-elevated transition-all hover:border-primary/25 hover:shadow-floating"
          >
            📋 شروط الاستخدام
          </Link>

          <Card className="p-5 text-body-sm leading-relaxed text-muted-foreground shadow-elevated">
            ℹ️ عن روزيرا — منصة حجز صالونات التجميل للسيدات في السعودية
          </Card>

          <Button variant="destructive" className="w-full rounded-2xl" onClick={() => setDelOpen(true)}>
            🗑️ حذف الحساب
          </Button>
        </div>
      </div>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent className="rounded-2xl border-border/60 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-heading-3">تأكيد حذف الحساب؟</DialogTitle>
          </DialogHeader>
          <p className="text-body-sm text-muted-foreground">لا يمكن التراجع. تواصلي مع الدعم لحذف كامل.</p>
          <Button variant="destructive" className="rounded-2xl" onClick={() => { setDelOpen(false); toast.message('تواصلي معنا لإكمال الطلب') }}>
            تأكيد
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
