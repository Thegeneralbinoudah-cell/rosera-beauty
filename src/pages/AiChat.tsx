import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Sparkles, Camera, ImageIcon, MapPin, Star, Loader2 } from 'lucide-react'
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
import type { RozyChatAction, RozySalonCard } from '@/lib/roseyChatTypes'
import { resolveBusinessCoverImage } from '@/lib/businessImages'
import { RosyStructuredAssistant } from '@/components/rosey/RosyStructuredAssistant'
import { RosyBookingGuide } from '@/components/rosey/RosyBookingGuide'
import { useI18n } from '@/hooks/useI18n'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'
import { trackEvent } from '@/lib/analytics'
import { fetchRosySalonBookingPreview, type RosySalonBookingPreview } from '@/lib/roseySalonBookingPreview'
import { cn } from '@/lib/utils'
import { VoiceWaveform } from '@/components/rosey/VoiceWaveform'
import { stopRosyVoicePlayback, ROSY_VOICE_PHASE_EVENT, isElevenLabsConfigured } from '@/lib/voice'

function tomorrowBookingIsoDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

type RosyBookingNavExtra = Partial<
  Pick<RoziBookingAction, 'service_id' | 'booking_date' | 'suggested_slots'>
> & {
  initialStep?: 1 | 2 | 3
  quick?: boolean
  /** خصم إضافي من روزي — يُطبَّق في الحجز بعد التحقق من إعدادات الصالون */
  rosyNegotiation?: { discountPercent: number }
}

async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)
  return { base64, mime: file.type || 'image/jpeg' }
}

type RosyVoiceUi = 'idle' | 'listening' | 'processing' | 'speaking'

type RosySpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((this: RosySpeechRecognitionLike, ev: RosySpeechResultEvent) => void) | null
  onerror: ((this: RosySpeechRecognitionLike, ev: RosySpeechErrorEvent) => void) | null
  onend: ((this: RosySpeechRecognitionLike, ev: Event) => void) | null
}

type RosySpeechResultRow = {
  isFinal: boolean
  length: number
  [i: number]: { transcript: string }
}

type RosySpeechResultEvent = {
  results: { length: number; [index: number]: RosySpeechResultRow }
}

type RosySpeechErrorEvent = Event & { error?: string }

function getRosySpeechRecognitionCtor(): (new () => RosySpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window &
    Partial<Record<'SpeechRecognition' | 'webkitSpeechRecognition', new () => RosySpeechRecognitionLike>>
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function rosyVoiceHaptic() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(18)
  } catch {
    /* ignore */
  }
}

function isSalonOwnerRosySalesRole(profileRole: string | null | undefined, isSalonPortal: boolean): boolean {
  if (isSalonPortal) return true
  const r = (profileRole ?? 'user').toLowerCase()
  return r === 'owner' || r === 'salon_owner' || r === 'business_owner'
}

export default function AiChat() {
  const { t } = useI18n()
  const { user, profile, isSalonPortal } = useAuth()
  const nav = useNavigate()
  const salonOwnerSalesMode = useMemo(
    () => isSalonOwnerRosySalesRole(profile?.role, isSalonPortal),
    [profile?.role, isSalonPortal]
  )
  const goBooking = useCallback((salonId: string, extra?: RosyBookingNavExtra) => {
    toast.message('جاري تحويلك للحجز ✨', { duration: 2400 })
    trackEvent('rosy_booking_click', {
      salonId,
      source: 'chat',
      ...(extra?.quick ? { quick: true } : {}),
      ...(extra?.rosyNegotiation?.discountPercent != null
        ? { rosyNegotiationPct: extra.rosyNegotiation.discountPercent }
        : {}),
    })
    const sp = new URLSearchParams()
    sp.set('source', 'rosy')
    if (extra?.quick) sp.set('quick', '1')
    nav(
      { pathname: `/booking/${salonId}`, search: `?${sp.toString()}` },
      {
        state: {
          preselect: extra?.service_id,
          suggestedDate: extra?.booking_date ?? undefined,
          suggestedSlots: extra?.suggested_slots,
          initialStep: extra?.initialStep,
          rosyNegotiation: extra?.rosyNegotiation,
        },
      }
    )
  }, [nav])
  const onBookingAction = useCallback(
    (a: RoziBookingAction) => {
      goBooking(a.salon_id, {
        service_id: a.service_id ?? undefined,
        booking_date: a.booking_date ?? undefined,
        suggested_slots: a.suggested_slots,
      })
    },
    [goBooking]
  )
  const { messages, loading, historyError, sending, sendMessage, reloadHistory, kickoffSalonOwnerVoiceSales } =
    useChat(user?.id, {
      onBookingAction,
      salonOwnerSalesMode,
      onSalonOwnerSubscriptionIntent: () => {
        if (user?.id) {
          trackEvent({
            event_type: 'rosy_salon_subscription_upsell_click',
            entity_type: 'profile',
            entity_id: user.id,
            user_id: user.id,
            metadata: { source: 'voice_sales' },
          })
        }
        nav('/salon/subscription')
      },
    })
  const [salonPreviewById, setSalonPreviewById] = useState<Map<string, RosySalonBookingPreview>>(() => new Map())
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const galRef = useRef<HTMLInputElement>(null)
  const camFallbackRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [faceScanOpen, setFaceScanOpen] = useState(false)
  const [liveCameraOpen, setLiveCameraOpen] = useState(false)
  const [faceScanConsent, setFaceScanConsent] = useState(false)
  const clientGeoRef = useRef<{ lat: number; lng: number } | null>(null)

  const [voiceUi, setVoiceUi] = useState<RosyVoiceUi>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const recognitionRef = useRef<RosySpeechRecognitionLike | null>(null)
  const lastVoiceSendRef = useRef<{ text: string; at: number }>({ text: '', at: 0 })
  const voiceSessionRef = useRef({ pending: false, expectTts: false })
  const prevSendingForVoiceRef = useRef(false)
  const voiceGotTranscriptRef = useRef(false)
  /** يبقى true بعد أول ضغطة مايك حتى توقفي المحادثة (🔴) أو خطأ يوقف الدورة */
  const voiceLoopActiveRef = useRef(false)
  const chatAliveRef = useRef(true)
  const resumeListenTimeoutRef = useRef<number | null>(null)
  /** أول ضغطة مايك في الجلسة: عرض صوتي لمالكة الصالون */
  const ownerSalesVoiceKickoffDoneRef = useRef(false)
  const historyErrorRef = useRef<string | null>(null)
  const loadingRef = useRef(false)
  const sendingRef = useRef(false)
  const startVoiceListeningInnerRef = useRef<(opts?: { silentHaptic?: boolean; skipCancelTts?: boolean }) => void>(
    () => {}
  )

  historyErrorRef.current = historyError
  loadingRef.current = loading
  sendingRef.current = sending

  const clearResumeListenTimeout = useCallback(() => {
    if (resumeListenTimeoutRef.current) {
      clearTimeout(resumeListenTimeoutRef.current)
      resumeListenTimeoutRef.current = null
    }
  }, [])

  const scheduleResumeListen = useCallback(
    (delayMs: number) => {
      clearResumeListenTimeout()
      resumeListenTimeoutRef.current = window.setTimeout(() => {
        resumeListenTimeoutRef.current = null
        if (!chatAliveRef.current || !voiceLoopActiveRef.current) return
        if (sendingRef.current || historyErrorRef.current || loadingRef.current) return
        startVoiceListeningInnerRef.current({ silentHaptic: true, skipCancelTts: true })
      }, delayMs)
    },
    [clearResumeListenTimeout]
  )

  const startVoiceListeningInner = useCallback(
    (opts?: { silentHaptic?: boolean; skipCancelTts?: boolean }) => {
      if (!chatAliveRef.current) return
      if (historyErrorRef.current || loadingRef.current) return
      const Ctor = getRosySpeechRecognitionCtor()
      if (!Ctor) {
        voiceLoopActiveRef.current = false
        toast.message('المتصفح ما يدعم التحدث حالياً — اكتبي لروزي 💕')
        setVoiceUi('idle')
        return
      }
      if (sendingRef.current) return

      if (!opts?.silentHaptic) rosyVoiceHaptic()
      if (!opts?.skipCancelTts) stopRosyVoicePlayback()
      setLiveTranscript('')

      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }

      const recognition = new Ctor()
      recognitionRef.current = recognition
      recognition.lang = 'ar-SA'
      recognition.continuous = false
      recognition.interimResults = true
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        let line = ''
        for (let i = 0; i < event.results.length; i++) {
          line += event.results[i]?.[0]?.transcript ?? ''
        }
        const preview = line.trim()
        if (preview) setLiveTranscript(preview)

        const finals: string[] = []
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i]?.isFinal) finals.push(event.results[i][0]?.transcript ?? '')
        }
        const transcript = finals.join('').trim()
        if (!transcript) return

        const now = Date.now()
        if (transcript === lastVoiceSendRef.current.text && now - lastVoiceSendRef.current.at < 1200) {
          return
        }
        lastVoiceSendRef.current = { text: transcript, at: now }

        voiceGotTranscriptRef.current = true
        voiceSessionRef.current = { pending: true, expectTts: false }
        setVoiceUi('processing')
        setLiveTranscript('')
        void sendMessage(transcript, null, clientGeoRef.current, { fromVoice: true }).finally(() => {
          requestAnimationFrame(() => {
            if (voiceSessionRef.current.pending) {
              voiceSessionRef.current.pending = false
              setVoiceUi((u) => (u === 'processing' ? 'idle' : u))
            }
          })
        })
      }

      recognition.onerror = (ev) => {
        const code = (ev as RosySpeechErrorEvent).error ?? ''
        if (code === 'no-speech') {
          setLiveTranscript('')
          setVoiceUi('idle')
          if (voiceLoopActiveRef.current) scheduleResumeListen(450)
          return
        }
        if (code === 'aborted') {
          setLiveTranscript('')
          setVoiceUi('idle')
          return
        }
        voiceLoopActiveRef.current = false
        if (code === 'not-allowed') {
          toast.message('فعّلي أذونات المايك من إعدادات المتصفح 💕')
        } else {
          toast.message('ما قدرت أسمع واضح — اكتبي أو كرّري المحاولة 💕')
        }
        setVoiceUi('idle')
      }

      recognition.onend = () => {
        if (voiceGotTranscriptRef.current) {
          voiceGotTranscriptRef.current = false
          return
        }
        setVoiceUi((s) => {
          if (s === 'listening') {
            if (voiceLoopActiveRef.current) scheduleResumeListen(400)
            return 'idle'
          }
          return s
        })
      }

      try {
        recognition.start()
        setVoiceUi('listening')
      } catch {
        voiceLoopActiveRef.current = false
        toast.message('تعذر تفعيل المايك — جرّبي الكتابة 💕')
        setVoiceUi('idle')
        recognitionRef.current = null
      }
    },
    [sendMessage, scheduleResumeListen]
  )

  useEffect(() => {
    startVoiceListeningInnerRef.current = startVoiceListeningInner
  }, [startVoiceListeningInner])

  useEffect(() => {
    const fn = (e: Event) => {
      const phase = (e as CustomEvent<{ phase?: string }>).detail?.phase
      if (phase === 'speaking') setVoiceUi('speaking')
    }
    window.addEventListener(ROSY_VOICE_PHASE_EVENT, fn as EventListener)
    return () => window.removeEventListener(ROSY_VOICE_PHASE_EVENT, fn as EventListener)
  }, [])

  useEffect(() => {
    if (sending && voiceSessionRef.current.pending) {
      voiceSessionRef.current.expectTts = true
      voiceSessionRef.current.pending = false
    }
  }, [sending])

  useEffect(() => {
    const wasSending = prevSendingForVoiceRef.current
    prevSendingForVoiceRef.current = sending
    if (wasSending && !sending && voiceSessionRef.current.expectTts) {
      voiceSessionRef.current.expectTts = false
      setLiveTranscript('')
      if (voiceLoopActiveRef.current) {
        const delay = isElevenLabsConfigured() ? 420 : 220
        scheduleResumeListen(delay)
      }
    }
  }, [sending, scheduleResumeListen])

  useEffect(() => {
    ownerSalesVoiceKickoffDoneRef.current = false
  }, [user?.id])

  useEffect(() => {
    chatAliveRef.current = true
    return () => {
      chatAliveRef.current = false
      clearResumeListenTimeout()
      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }
      stopRosyVoicePlayback()
    }
  }, [clearResumeListenTimeout])

  const toggleVoiceInput = useCallback(() => {
    if (historyError || loading) return
    const Ctor = getRosySpeechRecognitionCtor()
    if (!Ctor) {
      toast.message('المتصفح ما يدعم التحدث حالياً — اكتبي لروزي 💕')
      return
    }

    if (voiceUi === 'speaking') {
      stopRosyVoicePlayback()
      setVoiceUi('idle')
      setLiveTranscript('')
      if (voiceLoopActiveRef.current) scheduleResumeListen(140)
      return
    }

    if (voiceUi === 'listening' && recognitionRef.current) {
      voiceLoopActiveRef.current = false
      clearResumeListenTimeout()
      setLiveTranscript('')
      try {
        recognitionRef.current.abort()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
      setVoiceUi('idle')
      return
    }

    if (sending || voiceUi === 'processing') return

    if (salonOwnerSalesMode && !ownerSalesVoiceKickoffDoneRef.current) {
      ownerSalesVoiceKickoffDoneRef.current = true
      voiceLoopActiveRef.current = true
      clearResumeListenTimeout()
      void (async () => {
        await kickoffSalonOwnerVoiceSales()
        if (chatAliveRef.current && voiceLoopActiveRef.current) {
          scheduleResumeListen(isElevenLabsConfigured() ? 520 : 320)
        }
      })()
      return
    }

    voiceLoopActiveRef.current = true
    clearResumeListenTimeout()
    startVoiceListeningInner({ silentHaptic: false, skipCancelTts: false })
  }, [
    historyError,
    loading,
    sending,
    voiceUi,
    startVoiceListeningInner,
    scheduleResumeListen,
    clearResumeListenTimeout,
    salonOwnerSalesMode,
    kickoffSalonOwnerVoiceSales,
  ])

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clientGeoRef.current = { lat: p.coords.latitude, lng: p.coords.longitude }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 120_000 }
    )
  }, [])

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, voiceUi, liveTranscript])

  const salonIdsForPreview = useMemo(() => {
    const ids = new Set<string>()
    for (const m of messages) {
      m.salons?.forEach((s) => {
        if (s.id) ids.add(s.id)
      })
    }
    return [...ids]
  }, [messages])

  useEffect(() => {
    if (salonIdsForPreview.length === 0) {
      setSalonPreviewById(new Map())
      return
    }
    let cancelled = false
    void fetchRosySalonBookingPreview(salonIdsForPreview).then((map) => {
      if (!cancelled) setSalonPreviewById(map)
    })
    return () => {
      cancelled = true
    }
  }, [salonIdsForPreview])

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
    await sendMessage(t, null, clientGeoRef.current)
  }

  const onPickImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    try {
      const { base64, mime } = await fileToBase64(f)
      const text = input.trim()
      setInput('')
      await sendMessage(text || '', { base64, mime }, clientGeoRef.current)
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
    await sendMessage(input.trim() || '', { base64, mime }, clientGeoRef.current)
  }

  if (!user) return null

  const onlyWelcome = !loading && !historyError && messages.length === 1 && messages[0]?.id === 'welcome'

  const handleRozyAction = useCallback(
    (a: RozyChatAction) => {
      if (a.kind === 'negotiated_book' && a.salon_id) {
        const pct =
          typeof a.discount_percent === 'number' && Number.isFinite(a.discount_percent)
            ? a.discount_percent
            : undefined
        goBooking(a.salon_id, {
          service_id: a.service_id ?? undefined,
          rosyNegotiation: pct != null && pct > 0 ? { discountPercent: pct } : undefined,
        })
        return
      }
      if (a.kind === 'book' && a.salon_id) {
        goBooking(a.salon_id)
        return
      }
      if (a.kind === 'map') {
        nav(buildMapExploreUrl())
        return
      }
      if (a.kind === 'more') {
        void sendMessage('ابغى أشوف خيارات ثانية تناسبني', null, clientGeoRef.current)
        return
      }
      if (a.kind === 'retry') {
        void sendMessage('كمّلي نفس الطلب بطريقة ثانية لو سمحتي', null, clientGeoRef.current)
        return
      }
      if (a.kind === 'salon_upgrade') {
        if (user?.id) {
          trackEvent({
            event_type: 'rosy_salon_subscription_upsell_click',
            entity_type: 'profile',
            entity_id: user.id,
            user_id: user.id,
          })
        }
        nav('/salon/subscription')
        return
      }
      if (a.salon_id) {
        goBooking(a.salon_id)
      }
    },
    [goBooking, sendMessage, nav, user?.id]
  )

  const rosyAvatar = (size: 'sm' | 'md' = 'md') => (
    <div
      className={
        size === 'md'
          ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fce4ec] via-[#fbcfe8] to-[#f9a8c9] text-[#9B2257] shadow-[0_0_22px_rgba(249,168,201,0.55),0_2px_8px_rgba(190,24,93,0.12)] ring-2 ring-white/90 dark:ring-pink-950/40'
          : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fce4ec] via-[#fbcfe8] to-[#f9a8c9] text-[#9B2257] shadow-[0_0_18px_rgba(249,168,201,0.5)] ring-2 ring-white/90 dark:ring-pink-950/40'
      }
      aria-hidden
    >
      <Sparkles className={size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={2} />
    </div>
  )

  const renderRosySalonCards = (salons: RozySalonCard[]) => {
    const list = salons.slice(0, 3)
    return (
      <div className="w-full space-y-3">
        {list.map((salon) => {
          const img = resolveBusinessCoverImage(salon)
          const ratingLabel =
            salon.average_rating != null && salon.average_rating > 0
              ? t('aiChat.ratingShort', { n: salon.average_rating.toFixed(1) })
              : t('aiChat.ratingUnknown')
          const distLabel =
            salon.distance_km != null ? t('aiChat.distanceKm', { n: salon.distance_km.toFixed(1) }) : null
          const preview = salonPreviewById.get(salon.id)
          const canQuickBook =
            Boolean(preview && preview.serviceCount > 0 && preview.firstServiceId)

          return (
            <div
              key={salon.id}
              className="overflow-hidden rounded-xl border border-pink-500/20 bg-white shadow-md dark:border-pink-400/20 dark:bg-card"
            >
              <img src={img} alt="" className="aspect-[16/10] w-full object-cover" />
              <div className="space-y-3 p-3 pt-3">
                <div className="text-start">
                  <p className="line-clamp-2 text-sm font-bold leading-snug text-[#1F1F1F] dark:text-foreground">
                    {salon.name_ar}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
                      {ratingLabel}
                    </span>
                    {distLabel ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3.5 w-3.5 text-[#BE185D]/80" aria-hidden />
                        {distLabel}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-11 w-full rounded-xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-white shadow-sm transition-transform active:scale-95"
                    onClick={() => goBooking(salon.id)}
                  >
                    احجزي الآن
                  </Button>
                  {canQuickBook && preview?.firstServiceId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-11 w-full rounded-xl border border-pink-500/20 bg-pink-50/90 font-semibold text-[#9B2257] transition-transform hover:bg-pink-100/90 active:scale-95 dark:border-pink-400/20 dark:bg-pink-950/40 dark:text-pink-100 dark:hover:bg-pink-950/60"
                      onClick={() =>
                        goBooking(salon.id, {
                          service_id: preview.firstServiceId!,
                          booking_date: tomorrowBookingIsoDate(),
                          suggested_slots: ['10:00'],
                          quick: true,
                          initialStep: 2,
                        })
                      }
                    >
                      {t('aiChat.nearestSlotCta')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-11 w-full rounded-xl border-pink-500/25 text-[#BE185D] transition-transform hover:bg-pink-50 active:scale-95 dark:border-pink-400/20 dark:hover:bg-pink-950/30"
                    onClick={() => nav(`/map?focus=${encodeURIComponent(salon.id)}`)}
                  >
                    {t('aiChat.showOnMap')}
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderAssistantTextOnly = (row: ChatRow): ReactNode => {
    const sep = `\n\n${FACE_SCAN_MEDICAL_DISCLAIMER}`
    const idx = row.message.lastIndexOf(sep)
    if (idx === -1) {
      return <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1F1F1F] dark:text-foreground">{row.message}</p>
    }
    return (
      <div className="text-sm leading-relaxed">
        <p className="whitespace-pre-wrap text-[#1F1F1F] dark:text-foreground">{row.message.slice(0, idx)}</p>
        <div className="mt-3 border-t border-rose-200/80 pt-3 dark:border-rose-900/50">
          <p className="whitespace-pre-wrap text-rose-800 dark:text-rose-100">{FACE_SCAN_MEDICAL_DISCLAIMER}</p>
        </div>
      </div>
    )
  }

  const renderAssistantAttachments = (row: ChatRow): ReactNode => {
    const hasSalons = Boolean(row.salons?.length)
    return (
      <>
        {hasSalons && row.salons ? renderRosySalonCards(row.salons) : null}
        {row.actions?.length ? (
          <RosyStructuredAssistant
            salons={hasSalons ? undefined : row.salons}
            actions={row.actions}
            onBookSalon={(id) => goBooking(id)}
            onAction={handleRozyAction}
          />
        ) : null}
      </>
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
              مساعدة الحجز والجمال — نبرة سعودية دافئة ✨
            </p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
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
            {onlyWelcome ? (
              <div className="mx-auto max-w-lg space-y-6">
                <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-300 items-start gap-3">
                  {rosyAvatar('md')}
                  <div className="max-w-[min(100%,22rem)] rounded-2xl border border-pink-500/20 bg-white px-4 py-4 shadow-sm dark:border-pink-400/20 dark:bg-card">
                    <p className="text-sm font-bold leading-snug text-foreground">{t('aiChat.bookingWelcomeTitle')}</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                      {t('aiChat.bookingWelcomeSub')}
                    </p>
                  </div>
                </div>
                <RosyBookingGuide show onBookSalon={(id) => goBooking(id)} />
                <p className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm font-semibold text-[#BE185D]"
                    onClick={() => nav(buildMapExploreUrl())}
                  >
                    {t('aiChat.exploreMapLink')}
                  </Button>
                </p>
              </div>
            ) : (
              messages.map((row) =>
                row.is_user ? (
                  <div
                    key={row.id}
                    className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="max-w-[min(85%,26rem)] rounded-2xl bg-[#F9A8C9] px-4 py-3.5 text-white shadow-sm">
                      <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">{row.message}</p>
                    </div>
                  </div>
                ) : (
                  <div
                    key={row.id}
                    className="flex animate-in fade-in slide-in-from-bottom-2 duration-300 justify-start gap-3"
                  >
                    {rosyAvatar('md')}
                    <div className="flex min-w-0 max-w-[min(85%,28rem)] flex-col gap-3">
                      <div className="rounded-2xl border border-pink-500/20 bg-white px-4 py-3.5 shadow-sm dark:border-pink-400/20 dark:bg-card">
                        {renderAssistantTextOnly(row)}
                      </div>
                      {renderAssistantAttachments(row)}
                    </div>
                  </div>
                )
              )
            )}
            {sending && (
              <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-300 justify-start gap-3">
                {rosyAvatar('sm')}
                <div className="rounded-2xl border border-pink-500/20 bg-white px-4 py-3.5 shadow-sm dark:border-pink-400/20 dark:bg-card">
                  <p className="text-xs font-semibold text-[#9B2257]/90 dark:text-pink-200/90">روزي تكتب...</p>
                  <span className="mt-2 flex gap-1.5" aria-hidden>
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#F9A8C9] [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#F9A8C9] [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-[#F9A8C9] [animation-delay:300ms]" />
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

      <div className="sticky bottom-0 z-30 border-t border-primary/10 bg-white pb-[calc(5.25rem+env(safe-area-inset-bottom))] dark:bg-card">
        <div className="flex gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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

      <div className="pointer-events-none fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[min(100%,20rem)] -translate-x-1/2 flex-col items-center gap-2 px-4">
        <div className="pointer-events-auto flex w-full max-w-[18rem] flex-col items-center gap-2">
          {(voiceUi === 'listening' || voiceUi === 'processing') && (
            <div
              className="max-h-16 w-full overflow-y-auto rounded-2xl border border-pink-500/25 bg-white/95 px-3 py-2 text-center text-xs font-semibold leading-snug text-[#374151] shadow-lg backdrop-blur-md dark:border-pink-400/20 dark:bg-card/95 dark:text-foreground"
              dir="rtl"
            >
              {liveTranscript ? liveTranscript : voiceUi === 'processing' ? '⏳ …' : '… استمعي'}
            </div>
          )}
          <VoiceWaveform
            phase={
              voiceUi === 'speaking' ? 'speaking' : voiceUi === 'listening' ? 'listening' : 'idle'
            }
            className="drop-shadow-[0_0_14px_rgba(236,72,153,0.4)]"
          />
          <button
            type="button"
            disabled={
              !!historyError ||
              loading ||
              (voiceUi !== 'listening' &&
                voiceUi !== 'speaking' &&
                (sending || voiceUi === 'processing'))
            }
            onClick={() => void toggleVoiceInput()}
            aria-label={
              voiceUi === 'listening'
                ? 'إيقاف المحادثة الصوتية'
                : voiceUi === 'speaking'
                  ? 'قطع صوت روزي ومتابعة الحديث'
                  : voiceUi === 'processing'
                    ? 'جاري معالجة كلامك'
                    : 'تحدثي مع روزي — وضع محادثة متواصل'
            }
            className={cn(
              'flex h-[3.65rem] w-[3.65rem] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#fce4ec] via-[#fbcfe8] to-[#f472b6] text-lg shadow-[0_0_32px_rgba(236,72,153,0.55),0_8px_24px_rgba(190,24,93,0.18)] ring-2 ring-white/95 transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-45 dark:ring-pink-950/40',
              voiceUi === 'listening' && 'ring-4 ring-red-400/55 scale-[1.04]',
              voiceUi === 'processing' && 'ring-4 ring-amber-300/50',
              voiceUi === 'speaking' && 'ring-4 ring-violet-400/50 scale-[1.03] shadow-[0_0_36px_rgba(167,139,250,0.45)]'
            )}
          >
            {voiceUi === 'processing' ? (
              <Loader2 className="h-7 w-7 animate-spin text-[#9B2257]" aria-hidden />
            ) : voiceUi === 'listening' ? (
              <span className="text-2xl leading-none" aria-hidden>
                🔴
              </span>
            ) : voiceUi === 'speaking' ? (
              <span className="text-2xl leading-none" aria-hidden>
                ✨
              </span>
            ) : (
              <span className="text-2xl leading-none" aria-hidden>
                🎤
              </span>
            )}
          </button>
          <p className="pointer-events-none text-center text-[10px] font-medium text-muted-foreground drop-shadow-sm">
            {voiceUi === 'listening'
              ? 'متواصل — 🔴 يوقف'
              : voiceUi === 'speaking'
                ? 'ElevenLabs ✨ — اضغطي للقطع'
                : voiceUi === 'processing'
                  ? '⏳ روزي…'
                  : '🎤 محادثة صوتية فاخرة'}
          </p>
        </div>
      </div>
    </div>
  )
}
