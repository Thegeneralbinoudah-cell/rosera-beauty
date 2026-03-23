import { useEffect, useState, useRef, useCallback, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Sparkles, Camera, ImageIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  useChat,
  FACE_SCAN_MEDICAL_DISCLAIMER,
  FACE_SCAN_CONSENT_LABEL,
  type ChatRow,
  type RoziBookingAction,
} from '@/hooks/useChat'

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)
  return { base64, mime: file.type || 'image/jpeg' }
}

export default function AiChat() {
  const { user } = useAuth()
  const nav = useNavigate()
  const onBookingAction = useCallback(
    (a: RoziBookingAction) => {
      toast.success('نفتحي صفحة الحجز لإكمال الموعد')
      nav(`/booking/${a.salon_id}`, {
        state: {
          preselect: a.service_id || undefined,
          suggestedDate: a.booking_date || undefined,
          suggestedSlots: a.suggested_slots,
        },
      })
    },
    [nav]
  )
  const { messages, loading, historyError, sending, sendMessage, reloadHistory } = useChat(user?.id, {
    onBookingAction,
  })
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const camFallbackRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [faceScanOpen, setFaceScanOpen] = useState(false)
  const [liveCameraOpen, setLiveCameraOpen] = useState(false)
  const [faceScanConsent, setFaceScanConsent] = useState(false)

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [messages, sending])

  useEffect(() => {
    if (!liveCameraOpen) {
      stopCamera()
      return
    }
    let cancelled = false
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const v = videoRef.current
        if (v) {
          v.srcObject = stream
          void v.play().catch(() => {})
        }
      })
      .catch(() => {
        toast.error('تعذر فتح الكاميرا. جرّبي «رفع صورة من الملفات» أو تأكدي من أذونات المتصفح.')
        setLiveCameraOpen(false)
      })
    return () => {
      cancelled = true
      stopCamera()
    }
  }, [liveCameraOpen])

  useEffect(() => {
    if (!user) {
      nav('/auth')
    }
  }, [user, nav])

  const send = async (text: string) => {
    const t = text.trim()
    if (!t) return
    setInput('')
    await sendMessage(t, null)
  }

  const onPickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    try {
      const { base64, mime } = await fileToBase64(f)
      const text = input.trim()
      setInput('')
      await sendMessage(text || '', { base64, mime })
    } catch {
      /* ignore */
    }
  }

  const openFaceScanFlow = () => {
    setFaceScanConsent(false)
    setFaceScanOpen(true)
  }

  const startLiveAfterConsent = () => {
    if (!faceScanConsent) return
    setFaceScanOpen(false)
    setLiveCameraOpen(true)
  }

  const startUploadAfterConsent = () => {
    if (!faceScanConsent) return
    setFaceScanOpen(false)
    window.setTimeout(() => galRef.current?.click(), 0)
  }

  const captureFromVideo = async () => {
    const v = videoRef.current
    if (!v || v.videoWidth === 0) {
      toast.error('الكاميرا غير جاهزة بعد')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(v, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) return
    const file = new File([blob], 'face-capture.jpg', { type: 'image/jpeg' })
    const { base64, mime } = await fileToBase64(file)
    setLiveCameraOpen(false)
    await sendMessage(input.trim() || '', { base64, mime })
  }

  if (!user) return null

  const renderBubble = (row: ChatRow) => {
    if (row.is_user) {
      return <p className="whitespace-pre-wrap text-sm font-medium">{row.message}</p>
    }
    const sep = `\n\n${FACE_SCAN_MEDICAL_DISCLAIMER}`
    const idx = row.message.lastIndexOf(sep)
    if (idx === -1) {
      return <p className="whitespace-pre-wrap text-sm text-[#1F1F1F] dark:text-foreground">{row.message}</p>
    }
    const main = row.message.slice(0, idx)
    return (
      <div className="text-sm">
        <p className="whitespace-pre-wrap text-[#1F1F1F] dark:text-foreground">{main}</p>
        <div className="mt-3 border-t border-rose-200/80 pt-3 dark:border-rose-900/50">
          <p className="whitespace-pre-wrap text-rose-800 dark:text-rose-100">{FACE_SCAN_MEDICAL_DISCLAIMER}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-10 border-b border-primary/10 bg-white px-4 py-4 dark:bg-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#fce4ec] to-[#e91e8c] text-[#9B2257] shadow-md">
            <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#1F1F1F] dark:text-foreground">روزي</h1>
            <p className="text-xs font-medium text-[#374151] dark:text-rosera-gray">
              مساعدتكِ الشخصية — OpenAI • عربي • جمال • حجوزات • متجر
            </p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <p className="text-center font-medium text-[#374151] dark:text-rosera-gray">جاري التحميل...</p>
        ) : historyError ? (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm font-semibold text-destructive">{historyError}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => void reloadHistory()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          <>
            {messages.map((row) => (
              <div key={row.id} className={`mb-4 flex ${row.is_user ? 'justify-end' : 'justify-start'}`}>
                {!row.is_user && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fce4ec] to-[#e91e8c] text-[#9B2257]">
                    <Sparkles className="h-4 w-4" aria-hidden />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    row.is_user
                      ? 'bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-white'
                      : 'border border-primary/10 bg-white dark:bg-card'
                  }`}
                >
                  {renderBubble(row)}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start gap-1">
                <div className="rounded-2xl border border-primary/10 bg-white px-4 py-3 dark:bg-card">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            <p className="mt-4 text-center text-[11px] font-medium text-[#374151] dark:text-rosera-gray">
              صور الوجه تُرسَل للتحليل مؤقتاً فقط ولا تُحفَظ على خوادمنا ولا في سجل المحادثة.
            </p>
          </>
        )}
      </div>

      <Dialog
        open={faceScanOpen}
        onOpenChange={(open) => {
          setFaceScanOpen(open)
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تحليل الوجه</DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#1F1F1F] dark:text-foreground/90">
            {FACE_SCAN_MEDICAL_DISCLAIMER}
          </p>
          <p className="text-xs font-medium text-[#374151] dark:text-rosera-gray">
            لن نخزّن صورتك: تُستخدم لطلب التحليل فقط ثم تُهمل من الذاكرة.
          </p>
          <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-rosera-light/80 p-3 dark:bg-muted/30">
            <Checkbox
              id="face-scan-consent"
              checked={faceScanConsent}
              onCheckedChange={(v) => setFaceScanConsent(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="face-scan-consent" className="cursor-pointer text-sm font-semibold leading-snug text-[#1F1F1F] dark:text-foreground">
              {FACE_SCAN_CONSENT_LABEL}
            </Label>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full gap-2 bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
              disabled={!faceScanConsent}
              onClick={startLiveAfterConsent}
            >
              <Camera className="h-4 w-4" aria-hidden />
              التقاط صورة الآن
            </Button>
            <Button type="button" variant="outline" className="w-full gap-2" disabled={!faceScanConsent} onClick={startUploadAfterConsent}>
              <ImageIcon className="h-4 w-4" aria-hidden />
              رفع صورة من الملفات
            </Button>
            <Button type="button" variant="ghost" onClick={() => setFaceScanOpen(false)}>
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={liveCameraOpen}
        onOpenChange={(open) => {
          setLiveCameraOpen(open)
          if (!open) stopCamera()
        }}
      >
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>التقاط من الكاميرا</DialogTitle>
          </DialogHeader>
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setLiveCameraOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" className="bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={() => void captureFromVideo()}>
              التقاط وإرسال
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-1 text-xs sm:text-sm"
              onClick={() => {
                setLiveCameraOpen(false)
                window.setTimeout(() => camFallbackRef.current?.click(), 0)
              }}
            >
              فتح اختيار ملف (احتياطي)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
      <input ref={camFallbackRef} type="file" accept="image/*" capture="user" className="hidden" onChange={onPickImage} />

      <div className="sticky bottom-0 border-t border-primary/10 bg-white p-3 dark:bg-card">
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="shrink-0 rounded-2xl"
            aria-label="تحليل وجه — كاميرا أو رفع"
            disabled={!!historyError || loading}
            onClick={openFaceScanFlow}
          >
            <Sparkles className="h-5 w-5 text-[#9B2257]" />
          </Button>
          <Input
            className="flex-1 rounded-2xl"
            placeholder="اكتبي لروزي..."
            value={input}
            disabled={!!historyError || loading}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void send(input)}
          />
          <Button
            size="icon"
            className="shrink-0 rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
            disabled={!!historyError || loading || sending}
            onClick={() => void send(input)}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
