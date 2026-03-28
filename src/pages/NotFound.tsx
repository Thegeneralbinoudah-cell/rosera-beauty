import { Link } from 'react-router-dom'
import { Home, SearchSlash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/hooks/useI18n'

/**
 * 404 — مسارات غير معرّفة؛ لا نُعيد التوجيه صامتاً إلى /home حتى لا تُخفى الأخطاء.
 */
export default function NotFound() {
  const { t } = useI18n()

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted/80 ring-2 ring-primary/15">
          <SearchSlash className="h-10 w-10 text-foreground" aria-hidden />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">404</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">{t('notFound.title')}</h1>
        <p className="mt-3 text-body-sm leading-relaxed text-foreground">{t('notFound.subtitle')}</p>
        <Button asChild className="mt-8 min-h-[48px] rounded-2xl px-8 text-base font-semibold touch-manipulation">
          <Link to="/home" className="inline-flex items-center gap-2">
            <Home className="h-5 w-5" aria-hidden />
            {t('notFound.ctaHome')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
