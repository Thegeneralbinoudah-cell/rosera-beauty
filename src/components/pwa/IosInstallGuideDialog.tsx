import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { tr } from '@/lib/i18n'
import { usePreferences } from '@/contexts/PreferencesContext'

type IosInstallGuideDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** خطوات «شاركي ← أضيفي إلى الشاشة الرئيسية» — لا تستخدم beforeinstallprompt */
export function IosInstallGuideDialog({ open, onOpenChange }: IosInstallGuideDialogProps) {
  const { lang } = usePreferences()
  const isAr = lang === 'ar'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir={isAr ? 'rtl' : 'ltr'}
        className="max-w-md border-pink-100/80 bg-gradient-to-b from-white to-rose-50/90 dark:from-card dark:to-rose-950/20"
      >
        <DialogHeader>
          <DialogTitle
            className={`text-lg text-rose-900 dark:text-rose-50 ${isAr ? 'text-right' : 'text-left'}`}
          >
            {tr(lang, 'pwa.iosTitle')}
          </DialogTitle>
        </DialogHeader>
        <ol
          className={`list-decimal space-y-3 text-body text-foreground ${isAr ? 'pr-5 text-right' : 'pl-5 text-left'}`}
        >
          <li>{tr(lang, 'pwa.iosStep1')}</li>
          <li>{tr(lang, 'pwa.iosStep2')}</li>
        </ol>
      </DialogContent>
    </Dialog>
  )
}
