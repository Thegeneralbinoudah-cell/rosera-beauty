import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { captureProductEvent, sanitizeFeedbackNotePreview } from '@/lib/posthog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

const BOTTOM_OFFSET = 'calc(5.25rem + env(safe-area-inset-bottom, 0px))'

/**
 * تتبع تعليقات المستخدمين دون إبطاء التحميل — حوار خفيف عند الطلب فقط.
 */
export function IssueFeedbackPrompt() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')

  const submit = useCallback(() => {
    const path = pathname.slice(0, 120)
    const trimmed = note.trim()
    const preview = sanitizeFeedbackNotePreview(trimmed)
    captureProductEvent('user_feedback_issue', {
      path,
      has_note: trimmed.length > 0,
      note_len: Math.min(trimmed.length, 999),
      ...(preview ? { note_preview: preview } : {}),
    })
    if (import.meta.env.DEV) {
      console.info('[rosera:feedback]', { path, has_note: trimmed.length > 0 })
    }
    setOpen(false)
    setNote('')
    toast.success('شكراً — سنعمل على التحسين.')
  }, [note, pathname])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[38] max-w-[min(100vw-1.5rem,14rem)] touch-manipulation rounded-full border border-border/60 bg-card/90 px-3 py-2 text-[11px] font-semibold text-muted-foreground shadow-sm backdrop-blur-sm transition hover:bg-muted/80 hover:text-foreground supports-[backdrop-filter]:bg-card/75"
        style={{
          bottom: BOTTOM_OFFSET,
          insetInlineStart: 'max(0.75rem, env(safe-area-inset-inline-start, 0px))',
        }}
      >
        هل واجهت مشكلة؟
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-heading-3">إبلاغ عن مشكلة</DialogTitle>
            <p className="text-sm text-muted-foreground">
              نستقبل إشعارك بأمان — لا نرسل محتوى رسائل الدردشة أو بيانات حساسة.
            </p>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مختصر: ماذا حدث؟ (اختياري)"
            className="min-h-[88px] resize-y rounded-xl"
            maxLength={500}
            dir="auto"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" className="rounded-xl" onClick={submit}>
              إرسال
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
