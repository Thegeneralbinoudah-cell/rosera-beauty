import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useRosyPanel } from '@/contexts/RosyPanelContext'
import { cn } from '@/lib/utils'

const AiChat = lazy(() => import('@/pages/AiChat'))

export function RosyChatPanel() {
  const { open, setOpen } = useRosyPanel()
  const location = useLocation()
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)

  useEffect(() => {
    if (location.pathname === '/chat') setOpen(false)
  }, [location.pathname, setOpen])

  const handleClearConfirm = () => {
    setConfirmClearOpen(false)
    window.dispatchEvent(new CustomEvent('rosey-clear-chat'))
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen} modal>
        <SheetContent
          side="bottom"
          className={cn(
            'flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-t-3xl border-t border-primary/20 bg-gradient-to-b from-primary/[0.07] via-background to-card p-0 shadow-floating ring-1 ring-gold/10 dark:border-primary/20 dark:from-primary/10 dark:via-card dark:to-card',
            '[&>button:last-of-type]:hidden'
          )}
        >
          <div className="relative flex shrink-0 items-start justify-between gap-3 border-b border-border/45 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top,0px))]">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent"
              aria-hidden
            />
            <div className="min-w-0 flex-1 text-start">
              <p className="bg-gradient-to-l from-destructive via-primary to-accent bg-clip-text text-lg font-extrabold tracking-tight text-transparent dark:from-pink-200 dark:via-primary dark:to-amber-200">
                روزي ✨
              </p>
              <p className="text-xs font-medium text-foreground">مساعدتك الجمالية بالذكاء الاصطناعي</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[44px] min-w-[44px] rounded-2xl px-3 text-xs font-semibold text-primary touch-manipulation hover:bg-primary/10"
                onClick={() => setConfirmClearOpen(true)}
              >
                مسح المحادثة
              </Button>
              <button
                type="button"
                className="flex min-h-[44px] min-w-[44px] touch-manipulation items-center justify-center rounded-2xl p-2 text-foreground transition-colors hover:bg-pink-50 hover:text-foreground dark:hover:bg-pink-950/40"
                aria-label="إغلاق"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {open && location.pathname !== '/chat' ? (
              <Suspense
                fallback={
                  <div className="flex min-h-[12rem] items-center justify-center p-8 text-sm font-medium text-foreground">
                    جاري فتح روزي…
                  </div>
                }
              >
                <AiChat embedded />
              </Suspense>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent className="rounded-2xl border-border/60 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-bold leading-relaxed">
              متأكدة تبين تمسحين المحادثة؟
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setConfirmClearOpen(false)}>
              إلغاء
            </Button>
            <Button
              type="button"
              className="rounded-2xl font-semibold"
              onClick={handleClearConfirm}
            >
              نعم، امسحي
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
