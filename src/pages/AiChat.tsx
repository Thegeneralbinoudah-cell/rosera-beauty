import { useEffect, useState, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Sparkles, Camera, ImageIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'

/** Shown before capture, after results, and appended to stored assistant text for image analysis. */
const FACE_SCAN_MEDICAL_DISCLAIMER =
  '⚠️ تنبيه مهم: هذه التوصيات للمساعدة فقط ولا تغني عن\nاستشارة الطبيب المختص. يُرجى مراجعة طبيب متخصص قبل\nاتخاذ أي قرار علاجي.'

const FACE_SCAN_CONSENT_LABEL =
  'أوافق على أن هذه التوصيات للمساعدة فقط وليست تشخيصاً طبياً'

function appendMedicalDisclaimerToReply(reply: string): string {
  const t = reply.trim()
  if (!t) return FACE_SCAN_MEDICAL_DISCLAIMER
  if (t.includes(FACE_SCAN_MEDICAL_DISCLAIMER)) return t
  return `${t}\n\n${FACE_SCAN_MEDICAL_DISCLAIMER}`
}

type ChatRow = { id: string; message: string; is_user: boolean; created_at: string }
type ApiMsg = { role: 'user' | 'assistant'; content: string }

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)
  return { base64, mime: file.type || 'image/jpeg' }
}

function buildContextBlock(
  salons: { id: string; name_ar: string; city: string; category_label?: string | null; average_rating?: number }[],
  products: { id: string; name_ar: string; price: number }[]
) {
  const s =
    salons?.map((b) => `- ${b.name_ar} (${b.city}) [id=${b.id}] تقييم ${Number(b.average_rating ?? 0).toFixed(1)} — ${b.category_label ?? ''}`).join('\n') || ''
  const p =
    products?.map((x) => `- ${x.name_ar} [id=${x.id}] — ${Number(x.price).toFixed(0)} ر.س`).join('\n') || ''
  return `صالونات (للتوصية والحجز عبر /salon/{id} ثم زر الحجز):\n${s}\n\nمنتجات المتجر (/store، /product/{id}):\n${p}`
}

export default function AiChat() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [messages, setMessages] = useState<ChatRow[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [loading, setLoading] = useState(true)
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
  }, [messages, typing])

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
      return
    }
    let c = true
    async function load() {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, message, is_user, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      if (error || !c) return
      const rows = (data ?? []).map(
        (r: { id: string; message?: string; response?: string; is_user?: boolean; created_at: string }) => ({
          id: r.id,
          message: r.is_user ? (r.message || '') : (r.response || r.message || ''),
          is_user: r.is_user ?? true,
          created_at: r.created_at,
        })
      ) as ChatRow[]
      setMessages(rows)
      if (rows.length === 0) {
        setMessages([
          {
            id: 'welcome',
            message:
              'مرحباً! أنا روزي — مساعدتكِ في روزيرا. أقدر أرشدكِ لصالون أو عيادة تجميل، منتجات المتجر، الحجز، أو تحليل صورة للبشرة (بدون حفظ للصورة). كيف أخدمكِ؟',
            is_user: false,
            created_at: new Date().toISOString(),
          },
        ])
      }
      setLoading(false)
    }
    void load()
    return () => {
      c = false
    }
  }, [user, nav])

  const sendWithOptionalImage = async (text: string, image?: { base64: string; mime: string } | null) => {
    const msg = text.trim()
    if (!msg && !image) return
    if (!user) return
    const displayText = image ? (msg || 'صورة للتحليل (لا تُحفظ)') : msg
    setInput('')
    const userRow: ChatRow = {
      id: crypto.randomUUID(),
      message: displayText,
      is_user: true,
      created_at: new Date().toISOString(),
    }
    setMessages((m) => [...m, userRow])
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      message: displayText,
      is_user: true,
    })

    setTyping(true)
    try {
      const [{ data: salonData }, { data: productData }] = await Promise.all([
        supabase
          .from('businesses')
          .select('id,name_ar,city,category_label,average_rating')
          .eq('is_active', true)
          .eq('is_demo', false)
          .order('average_rating', { ascending: false })
          .limit(28),
        supabase
          .from('products')
          .select('id,name_ar,price')
          .eq('is_active', true)
          .eq('is_demo', false)
          .limit(18),
      ])

      const contextBlock = buildContextBlock(
        (salonData ?? []) as Parameters<typeof buildContextBlock>[0],
        (productData ?? []) as Parameters<typeof buildContextBlock>[1]
      )

      const priorRows = [...messages.filter((m) => m.id !== 'welcome'), userRow]
      const apiHistory: ApiMsg[] = priorRows.map((m) => ({
        role: m.is_user ? 'user' : 'assistant',
        content: m.message,
      }))
      if (image && !msg) {
        apiHistory[apiHistory.length - 1] = {
          role: 'user',
          content: 'تحليل صورة الوجه للبشرة والعلاجات المقترحة (بدون حفظ الصورة)',
        }
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const { data, error } = await supabase.functions.invoke('rozi-chat', {
        body: {
          messages: apiHistory,
          contextBlock,
          imageBase64: image?.base64,
          imageMimeType: image?.mime,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      let botText: string
      if (error) {
        botText =
          'تعذر الاتصال بروزي الآن. تأكدي من نشر دالة rozi-chat وضبط OPENAI_API_KEY أو GEMINI_API_KEY في أسرار المشروع. يمكنكِ تصفح الخريطة أو المتجر يدوياً.'
      } else if (data && typeof (data as { reply?: string }).reply === 'string') {
        botText = (data as { reply: string }).reply
      } else if (data && typeof (data as { error?: string }).error === 'string') {
        botText = `عذراً: ${(data as { error: string }).error}`
      } else {
        botText = 'لم أستلم رداً واضحاً — جرّبي صياغة أخرى أو لاحقاً.'
      }

      const messageToStore = image ? appendMedicalDisclaimerToReply(botText) : botText

      const botRow: ChatRow = {
        id: crypto.randomUUID(),
        message: messageToStore,
        is_user: false,
        created_at: new Date().toISOString(),
      }
      setMessages((m) => [...m, botRow])
      await supabase.from('chat_messages').insert({
        user_id: user.id,
        message: messageToStore,
        response: messageToStore,
        is_user: false,
      })
    } catch {
      const botRow: ChatRow = {
        id: crypto.randomUUID(),
        message: 'حدث خطأ — حاولي مرة أخرى.',
        is_user: false,
        created_at: new Date().toISOString(),
      }
      setMessages((m) => [...m, botRow])
    } finally {
      setTyping(false)
    }
  }

  const send = async (text: string) => {
    await sendWithOptionalImage(text, null)
  }

  const onPickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    try {
      const { base64, mime } = await fileToBase64(f)
      await sendWithOptionalImage(input.trim() || '', { base64, mime })
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
    await sendWithOptionalImage(input.trim() || '', { base64, mime })
  }

  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-10 border-b border-primary/10 bg-white px-4 py-4 dark:bg-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#fce4ec] to-[#e91e8c] text-[#9B2257] shadow-md">
            <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-[#1F1F1F] dark:text-foreground">روزي</h1>
            <p className="text-xs font-medium text-[#374151] dark:text-rosera-gray">مساعدتكِ الشخصية — عربي • جمال • حجوزات • متجر</p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <p className="text-center font-medium text-[#374151] dark:text-rosera-gray">جاري التحميل...</p>
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
                  {(() => {
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
                  })()}
                </div>
              </div>
            ))}
            {typing && (
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
            onClick={openFaceScanFlow}
          >
            <Sparkles className="h-5 w-5 text-[#9B2257]" />
          </Button>
          <Input
            className="flex-1 rounded-2xl"
            placeholder="اكتبي لروزي..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void send(input)}
          />
          <Button
            size="icon"
            className="shrink-0 rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
            onClick={() => void send(input)}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
