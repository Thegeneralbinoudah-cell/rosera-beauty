import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  type ChangeEvent,
  type ReactNode,
} from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Send, Sparkles, Camera, ImageIcon, MapPin, Star, Loader2, Package, Mic } from 'lucide-react'
import { pickMediaRecorderMimeType, isMediaRecorderSupported } from '@/lib/webVoiceRecording'
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
import type { RozyChatAction, RozyProductCard, RozySalonCard } from '@/lib/roseyChatTypes'
import { resolveBusinessCoverImage } from '@/lib/businessImages'
import { RosyStructuredAssistant } from '@/components/rosey/RosyStructuredAssistant'
import { RosyBookingGuide } from '@/components/rosey/RosyBookingGuide'
import { CartHeaderButton } from '@/components/store/CartHeaderButton'
import { useI18n } from '@/hooks/useI18n'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'
import { trackEvent } from '@/lib/analytics'
import { queueRoziEvent } from '@/lib/insertRoziEvent'
import { markRozySalonDetailBookingBoost } from '@/lib/rozySalonDetailBoost'
import { captureProductEvent } from '@/lib/posthog'
import { useCartStore } from '@/stores/cartStore'
import { fetchRosySalonBookingPreview, type RosySalonBookingPreview } from '@/lib/roseySalonBookingPreview'
import { cn } from '@/lib/utils'

const EMPTY_SALON_PREVIEW_MAP = new Map<string, RosySalonBookingPreview>()
import type { RozyVisionChatAdvisorMode } from '@/lib/rozyVisionChatTypes'
import { VISION_FAIL_AR } from '@/lib/rozyVisionChatInvoke'
import { RosyVisionChatResults } from '@/components/chat/RosyVisionChatResults'
import { VoiceWaveform } from '@/components/rosey/VoiceWaveform'
import { stopRosyVoicePlayback, ROSY_VOICE_PHASE_EVENT, isElevenLabsConfigured } from '@/lib/voice'
import rozyFabPortrait from '@/assets/rozy.png'

function tomorrowBookingIsoDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

type RoziChatInteractionCtx = {
  recommendationMode?: ChatRow['recommendationMode']
  chatMessageId?: string | null
}

type RosyBookingNavExtra = Partial<
  Pick<RoziBookingAction, 'service_id' | 'booking_date' | 'suggested_slots'>
> & {
  /** BookingFlow: 1=خدمة 2=موظف 3=موعد 4=تأكيد 5=دفع — quick يستخدم 3 بعد اختيار الخدمة */
  initialStep?: 1 | 2 | 3 | 4 | 5
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

export default function AiChat({ embedded = false }: { embedded?: boolean }) {
  const { t, lang } = useI18n()
  const { user, profile, isSalonPortal, loading: authLoading } = useAuth()
  const nav = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const salonOwnerSalesMode = useMemo(
    () => isSalonOwnerRosySalesRole(profile?.role, isSalonPortal),
    [profile?.role, isSalonPortal]
  )
  const rosyBookingFromChatRef = useRef(false)
  const messagesForAbandonRef = useRef<ChatRow[]>([])
  const embeddedForAbandonRef = useRef(embedded)
  const rosyFirstMessageSeenRef = useRef(false)

  const goSalonDetail = useCallback(
    (salonId: string, serviceId?: string | null) => {
      const svc = serviceId?.trim() || ''
      captureProductEvent('rosy_to_booking', {
        salon_id: salonId,
        cta: 'view_details',
        ...(svc ? { service_id: svc } : {}),
      })
      captureProductEvent('rosy_to_booking_click', { salon_id: salonId })
      trackEvent('rosy_booking_click', {
        salonId,
        source: 'chat',
        cta: 'view_details',
        ...(svc ? { serviceId: svc } : {}),
      })
      nav(`/salon/${salonId}`, { state: { preselect: svc || undefined, source: 'rosy' } })
    },
    [nav]
  )

  const goBooking = useCallback((salonId: string, extra?: RosyBookingNavExtra) => {
    rosyBookingFromChatRef.current = true
    const preSvc = extra?.service_id?.trim() || ''
    captureProductEvent('rosy_to_booking', {
      salon_id: salonId,
      cta: 'book_now',
      ...(preSvc ? { service_id: preSvc } : {}),
    })
    captureProductEvent('rosy_to_booking_click', { salon_id: salonId })
    toast.message('جاري تحويلك للحجز', { duration: 2400 })
    trackEvent('rosy_booking_click', {
      salonId,
      source: 'chat',
      cta: 'book_now',
      ...(preSvc ? { serviceId: preSvc } : {}),
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
      if (user?.id) {
        queueRoziEvent({
          user_id: user.id,
          action_type: 'book',
          entity_id: a.salon_id,
          recommendation_mode: null,
          metadata: { surface: 'booking_action' },
        })
      }
      goBooking(a.salon_id, {
        service_id: a.service_id ?? undefined,
        booking_date: a.booking_date ?? undefined,
        suggested_slots: a.suggested_slots,
      })
    },
    [goBooking, user]
  )
  const {
    messages,
    loading,
    historyError,
    sending,
    sendingImage,
    sendMessage,
    reloadHistory,
    clearChatHistory,
    kickoffSalonOwnerVoiceSales,
  } = useChat(user?.id, {
      onBookingAction,
      salonOwnerSalesMode,
      profileCityForRozy: profile?.city ?? null,
      onSalonOwnerSubscriptionIntent: () => {
        if (user?.id) {
          trackEvent({
            event_type: 'rosy_salon_subscription_upsell_click',
            entity_type: 'preference',
            entity_id: user.id,
            user_id: user.id,
            metadata: { source: 'voice_sales' },
          })
        }
        nav('/salon/subscription')
      },
    })

  useEffect(() => {
    messagesForAbandonRef.current = messages
    embeddedForAbandonRef.current = embedded
  }, [messages, embedded])

  useEffect(() => {
    if (loading || rosyFirstMessageSeenRef.current) return
    if (!messages.some((m) => !m.is_user)) return
    rosyFirstMessageSeenRef.current = true
    captureProductEvent('rosy_first_message_seen', {
      mode: salonOwnerSalesMode ? 'owner_sales' : 'customer',
      embedded,
    })
  }, [messages, loading, salonOwnerSalesMode, embedded])

  useEffect(() => {
    return () => {
      const m = messagesForAbandonRef.current
      const hadUserMessage = m.some((x) => x.is_user)
      if (hadUserMessage && !rosyBookingFromChatRef.current) {
        captureProductEvent('rosy_abandon', {
          embedded: embeddedForAbandonRef.current,
        })
      }
    }
  }, [])

  useEffect(() => {
    const onClear = () => void clearChatHistory()
    window.addEventListener('rosey-clear-chat', onClear)
    return () => window.removeEventListener('rosey-clear-chat', onClear)
  }, [clearChatHistory])

  useEffect(() => {
    captureProductEvent('rosy_open', {
      mode: salonOwnerSalesMode ? 'owner_sales' : 'customer',
      embedded,
    })
  }, [salonOwnerSalesMode, embedded])
  const [salonPreviewById, setSalonPreviewById] = useState<Map<string, RosySalonBookingPreview>>(() => new Map())
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)

  /** iOS / Android: اجعل حقل الإدخال فوق لوحة المفاتيح — يعمل في الوضع المضمّن وصفحة /chat الكاملة */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return
    const vv = window.visualViewport
    const scrollInputIntoView = () => {
      if (document.activeElement === chatInputRef.current) {
        chatInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    vv.addEventListener('resize', scrollInputIntoView)
    vv.addEventListener('scroll', scrollInputIntoView)
    return () => {
      vv.removeEventListener('resize', scrollInputIntoView)
      vv.removeEventListener('scroll', scrollInputIntoView)
    }
  }, [])

  const galRef = useRef<HTMLInputElement>(null)
  const camFallbackRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [faceScanOpen, setFaceScanOpen] = useState(false)
  const [liveCameraOpen, setLiveCameraOpen] = useState(false)
  const [faceScanConsent, setFaceScanConsent] = useState(false)
  const [advisorMode, setAdvisorMode] = useState<RozyVisionChatAdvisorMode | null>(null)
  /** يُحدَّد عند «التقاط/رفع» ويُستهلك عند الإرسال — لا يُمسح عند إغلاق حوار الموافقة */
  const committedAdvisorModeRef = useRef<RozyVisionChatAdvisorMode | null>(null)
  /** إغلاق كاميرا مباشر للانتقال لاختيار ملف — لا تُفرَّغ الوضع قبل onPickImage */
  const photoPickFromLiveRef = useRef(false)
  const clientGeoRef = useRef<{ lat: number; lng: number } | null>(null)

  const [voiceUi, setVoiceUi] = useState<RosyVoiceUi>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [voiceCaptureStream, setVoiceCaptureStream] = useState<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordChunksRef = useRef<Blob[]>([])
  const voiceCaptureStreamRef = useRef<MediaStream | null>(null)
  const lastRecordingObjectUrlRef = useRef<string | null>(null)
  const liveTranscriptRef = useRef('')
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
  const loadingRef = useRef(false)
  const sendingRef = useRef(false)
  const startVoiceListeningInnerRef = useRef<(opts?: { silentHaptic?: boolean; skipCancelTts?: boolean }) => void>(
    () => {}
  )

  useEffect(() => {
    loadingRef.current = loading
    sendingRef.current = sending
  }, [loading, sending])

  useEffect(() => {
    liveTranscriptRef.current = liveTranscript
  }, [liveTranscript])

  const clearResumeListenTimeout = useCallback(() => {
    if (resumeListenTimeoutRef.current) {
      clearTimeout(resumeListenTimeoutRef.current)
      resumeListenTimeoutRef.current = null
    }
  }, [])

  /** Immediate mic release (no blob) — unmount / hard reset */
  const syncStopVoiceCapture = useCallback(() => {
    try {
      mediaRecorderRef.current?.stop()
    } catch {
      /* ignore */
    }
    mediaRecorderRef.current = null
    recordChunksRef.current = []
    voiceCaptureStreamRef.current?.getTracks().forEach((t) => t.stop())
    voiceCaptureStreamRef.current = null
    setVoiceCaptureStream(null)
  }, [])

  /** Web `MediaRecorder` stop — same role as Expo `Audio.Recording.stopAndUnloadAsync` + URI */
  const stopVoiceRecording = useCallback((): Promise<{ url: string | null }> => {
    return new Promise((resolve) => {
      const mr = mediaRecorderRef.current
      const stream = voiceCaptureStreamRef.current
      if (!mr || mr.state === 'inactive') {
        stream?.getTracks().forEach((t) => t.stop())
        voiceCaptureStreamRef.current = null
        setVoiceCaptureStream(null)
        mediaRecorderRef.current = null
        resolve({ url: null })
        return
      }
      mr.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || 'audio/webm' })
        recordChunksRef.current = []
        let url: string | null = null
        if (blob.size > 0) {
          if (lastRecordingObjectUrlRef.current) URL.revokeObjectURL(lastRecordingObjectUrlRef.current)
          url = URL.createObjectURL(blob)
          lastRecordingObjectUrlRef.current = url
        }
        stream?.getTracks().forEach((t) => t.stop())
        voiceCaptureStreamRef.current = null
        setVoiceCaptureStream(null)
        mediaRecorderRef.current = null
        resolve({ url })
      }
      mr.stop()
    })
  }, [])

  const startVoiceRecordingPipeline = useCallback(async () => {
    if (!isMediaRecorderSupported()) return
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    if (!chatAliveRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    const mime = pickMediaRecorderMimeType()
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
    mediaRecorderRef.current = mr
    voiceCaptureStreamRef.current = stream
    setVoiceCaptureStream(stream)
    recordChunksRef.current = []
    mr.ondataavailable = (e) => {
      if (e.data.size) recordChunksRef.current.push(e.data)
    }
    mr.start(250)
  }, [])

  const scheduleResumeListen = useCallback(
    (delayMs: number) => {
      clearResumeListenTimeout()
      resumeListenTimeoutRef.current = window.setTimeout(() => {
        resumeListenTimeoutRef.current = null
        if (!chatAliveRef.current || !voiceLoopActiveRef.current) return
        if (sendingRef.current || loadingRef.current) return
        startVoiceListeningInnerRef.current({ silentHaptic: true, skipCancelTts: true })
      }, delayMs)
    },
    [clearResumeListenTimeout]
  )

  const startVoiceListeningInner = useCallback(
    async (opts?: { silentHaptic?: boolean; skipCancelTts?: boolean }) => {
      if (!chatAliveRef.current) return
      if (loadingRef.current) return
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
      syncStopVoiceCapture()

      try {
        await startVoiceRecordingPipeline()
      } catch {
        voiceLoopActiveRef.current = false
        toast.message('تعذر تفعيل المايك — جرّبي الكتابة 💕')
        setVoiceUi('idle')
        return
      }

      if (!chatAliveRef.current) {
        syncStopVoiceCapture()
        return
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
        void (async () => {
          await stopVoiceRecording()
          if (!chatAliveRef.current) return
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
        })()
      }

      recognition.onerror = (ev) => {
        const code = (ev as RosySpeechErrorEvent).error ?? ''
        void stopVoiceRecording()
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
        syncStopVoiceCapture()
        toast.message('تعذر تفعيل المايك — جرّبي الكتابة 💕')
        setVoiceUi('idle')
        recognitionRef.current = null
      }
    },
    [
      sendMessage,
      scheduleResumeListen,
      startVoiceRecordingPipeline,
      stopVoiceRecording,
      syncStopVoiceCapture,
    ]
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
      queueMicrotask(() => {
        setLiveTranscript('')
        if (voiceLoopActiveRef.current) {
          const delay = isElevenLabsConfigured() ? 420 : 220
          scheduleResumeListen(delay)
        }
      })
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
      syncStopVoiceCapture()
      if (lastRecordingObjectUrlRef.current) {
        URL.revokeObjectURL(lastRecordingObjectUrlRef.current)
        lastRecordingObjectUrlRef.current = null
      }
      try {
        recognitionRef.current?.abort()
      } catch {
        /* ignore */
      }
      stopRosyVoicePlayback()
    }
  }, [clearResumeListenTimeout, syncStopVoiceCapture])

  const toggleVoiceInput = useCallback(() => {
    if (loading) return
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
      const captured = liveTranscriptRef.current.trim()
      try {
        recognitionRef.current.abort()
      } catch {
        /* ignore */
      }
      recognitionRef.current = null
      setLiveTranscript('')
      void (async () => {
        await stopVoiceRecording()
        setVoiceUi('idle')
        if (captured) setInput((p) => (p ? `${p} ${captured}` : captured))
      })()
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
    loading,
    sending,
    voiceUi,
    startVoiceListeningInner,
    scheduleResumeListen,
    clearResumeListenTimeout,
    salonOwnerSalesMode,
    kickoffSalonOwnerVoiceSales,
    stopVoiceRecording,
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

  const salonPreviewEffective =
    salonIdsForPreview.length === 0 ? EMPTY_SALON_PREVIEW_MAP : salonPreviewById

  useEffect(() => {
    if (salonIdsForPreview.length === 0) return
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
      photoPickFromLiveRef.current = false
      const { base64, mime } = await fileToBase64(f)
      const text = input.trim()
      setInput('')
      const mode = committedAdvisorModeRef.current
      committedAdvisorModeRef.current = null
      await sendMessage(text || '', { base64, mime }, clientGeoRef.current, {
        visionAdvisorMode: mode ?? undefined,
      })
      setAdvisorMode(null)
    } catch {
      /* ignore */
    }
  }

  const openFaceScanFlow = () => {
    committedAdvisorModeRef.current = null
    photoPickFromLiveRef.current = false
    setFaceScanConsent(false)
    setAdvisorMode(null)
    setFaceScanOpen(true)
  }

  const launchHandledRef = useRef<string | null>(null)
  useEffect(() => {
    const launch = searchParams.get('launch')
    if (!launch) return
    if (launchHandledRef.current === launch) return
    launchHandledRef.current = launch

    if (launch === 'camera') {
      openFaceScanFlow()
    } else if (launch === 'voice') {
      void toggleVoiceInput()
    }

    const next = new URLSearchParams(searchParams)
    next.delete('launch')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, openFaceScanFlow, toggleVoiceInput])

  const startLiveAfterConsent = () => {
    if (!faceScanConsent || !advisorMode) return
    committedAdvisorModeRef.current = advisorMode
    setFaceScanOpen(false)
    setLiveCameraOpen(true)
  }

  const startUploadAfterConsent = () => {
    if (!faceScanConsent || !advisorMode) return
    committedAdvisorModeRef.current = advisorMode
    setFaceScanOpen(false)
    window.setTimeout(() => galRef.current?.click(), 0)
  }

  const captureFromVideo = async () => {
    const mode = committedAdvisorModeRef.current
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
    committedAdvisorModeRef.current = null
    await sendMessage(input.trim() || '', { base64, mime }, clientGeoRef.current, {
      visionAdvisorMode: mode ?? undefined,
    })
  }

  const onlyWelcome = !loading && !historyError && messages.length === 1 && messages[0]?.id === 'welcome'

  const handleRozyAction = useCallback(
    (a: RozyChatAction, ctx?: RoziChatInteractionCtx) => {
      const mode = ctx?.recommendationMode ?? null
      const metaBase: Record<string, unknown> = {
        ...(ctx?.chatMessageId ? { chat_message_id: ctx.chatMessageId } : {}),
        surface: 'structured_cta',
      }
      const trackRozi = (
        action_type: 'book' | 'salon_detail' | 'view_product' | 'add_to_cart' | 'checkout',
        entity_id?: string | null,
        extra?: Record<string, unknown>
      ) => {
        if (!user?.id) return
        queueRoziEvent({
          user_id: user.id,
          action_type,
          entity_id: entity_id ?? null,
          recommendation_mode: mode,
          metadata: { ...metaBase, ...extra },
        })
      }

      if (a.kind === 'negotiated_book' && a.salon_id) {
        const pct =
          typeof a.discount_percent === 'number' && Number.isFinite(a.discount_percent)
            ? a.discount_percent
            : undefined
        trackRozi('book', a.salon_id, { rozy_action_kind: 'negotiated_book' })
        goBooking(a.salon_id, {
          service_id: a.service_id ?? undefined,
          rosyNegotiation: pct != null && pct > 0 ? { discountPercent: pct } : undefined,
        })
        return
      }
      if (a.kind === 'salon_detail' && a.salon_id) {
        trackRozi('salon_detail', a.salon_id)
        markRozySalonDetailBookingBoost(a.salon_id)
        goSalonDetail(a.salon_id, a.service_id)
        return
      }
      if (a.kind === 'book' && a.salon_id) {
        trackRozi('book', a.salon_id, { rozy_action_kind: 'book' })
        goBooking(a.salon_id, { service_id: a.service_id ?? undefined })
        return
      }
      if (a.kind === 'map') {
        nav(buildMapExploreUrl())
        return
      }
      if (a.kind === 'store') {
        nav('/store')
        return
      }
      if (a.kind === 'view_product' && a.product_id) {
        trackRozi('view_product', a.product_id)
        nav(`/product/${encodeURIComponent(a.product_id)}`)
        return
      }
      if (a.kind === 'go_to_checkout') {
        trackRozi('checkout', null)
        useCartStore.getState().markRosyCheckoutCtaClicked()
        nav('/checkout')
        return
      }
      if (a.kind === 'add_to_cart' && a.product_id) {
        trackRozi('add_to_cart', a.product_id)
        const cart = useCartStore.getState()
        const hadBefore = cart.items.some((i) => i.productId === a.product_id)
        cart.add({
          productId: a.product_id,
          name_ar: a.product_name_ar ?? 'منتج',
          brand_ar: a.product_brand_ar ?? undefined,
          image_url: a.product_image_url ?? undefined,
          price: typeof a.product_price === 'number' && Number.isFinite(a.product_price) ? a.product_price : 0,
        })
        if (hadBefore) cart.bumpCartUiPulse()
        toast.success(t('store.addedToast'))
        if (user?.id) {
          trackEvent({
            event_type: 'click',
            entity_type: 'product',
            entity_id: a.product_id,
            user_id: user.id,
            metadata: { source: 'rosy_add_to_cart' },
          })
        }
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
            entity_type: 'preference',
            entity_id: user.id,
            user_id: user.id,
          })
        }
        nav('/salon/subscription')
        return
      }
      if (a.salon_id) {
        trackRozi('book', a.salon_id, { rozy_action_kind: a.kind })
        goBooking(a.salon_id)
      }
    },
    [goBooking, goSalonDetail, sendMessage, nav, user, t]
  )

  if (authLoading) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-3 text-foreground',
          embedded ? 'min-h-[12rem] flex-1' : 'luxury-page-canvas min-h-dvh'
        )}
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium">جاري التحميل...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" replace />
  }

  const rosyAvatar = (size: 'sm' | 'md' = 'md') => (
    <div
      className={
        size === 'md'
          ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-card via-primary/15 to-primary/25 text-primary shadow-[0_0_20px_rgb(244_114_182/0.35)] ring-2 ring-primary/25'
          : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-card via-primary/15 to-primary/25 text-primary shadow-[0_0_16px_rgb(244_114_182/0.28)] ring-2 ring-primary/20'
      }
      aria-hidden
    >
      <Sparkles className={size === 'md' ? 'h-5 w-5' : 'h-4 w-4'} strokeWidth={2} />
    </div>
  )

  const renderRosyProductCards = (products: RozyProductCard[], ctx?: RoziChatInteractionCtx) => {
    const list = products.slice(0, 3)
    return (
      <div className="w-full space-y-3">
        <p className="text-start text-xs font-semibold text-foreground">{t('aiChat.pickProducts')}</p>
        {list.map((p) => {
          const img = p.image_url?.trim() ? p.image_url : null
          return (
            <div
              key={p.id}
              className="overflow-hidden rounded-[8px] border border-border bg-card shadow-md"
            >
              {img ? (
                <img src={img} alt="" className="aspect-[16/10] w-full object-cover" />
              ) : (
                <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-muted/80 to-muted/50">
                  <Package className="h-10 w-10 text-primary" aria-hidden />
                </div>
              )}
              <div className="space-y-2 p-3">
                <div className="text-start">
                  <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                    {p.name_ar}
                  </p>
                  {p.brand_ar ? (
                    <p className="mt-0.5 text-xs text-foreground">{p.brand_ar}</p>
                  ) : null}
                  <p className="mt-1 text-sm font-semibold text-primary">
                    {p.price.toLocaleString('ar-SA', { maximumFractionDigits: 2 })} ر.س
                  </p>
                  <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-foreground">{p.benefit}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-11 w-full rounded-[4px] border-border text-foreground transition-transform hover:bg-muted/80 active:scale-95"
                  onClick={() => {
                    if (user?.id) {
                      queueRoziEvent({
                        user_id: user.id,
                        action_type: 'view_product',
                        entity_id: p.id,
                        recommendation_mode: ctx?.recommendationMode ?? null,
                        metadata: {
                          ...(ctx?.chatMessageId ? { chat_message_id: ctx.chatMessageId } : {}),
                          surface: 'product_card',
                        },
                      })
                    }
                    nav(`/product/${encodeURIComponent(p.id)}`)
                  }}
                >
                  {lang === 'ar' ? 'تفاصيل المنتج' : 'View product'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderRosySalonCards = (salons: RozySalonCard[], ctx?: RoziChatInteractionCtx) => {
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
          const preview = salonPreviewEffective.get(salon.id)
          const canQuickBook =
            Boolean(preview && preview.serviceCount > 0 && preview.firstServiceId)
          const suggestedSvc = preview?.firstServiceNameAr?.trim()
          const trackSalon = (
            action_type: 'book' | 'salon_detail',
            entityId: string,
            extra?: Record<string, unknown>
          ) => {
            if (!user?.id) return
            queueRoziEvent({
              user_id: user.id,
              action_type,
              entity_id: entityId,
              recommendation_mode: ctx?.recommendationMode ?? null,
              metadata: {
                ...(ctx?.chatMessageId ? { chat_message_id: ctx.chatMessageId } : {}),
                surface: 'salon_card',
                ...extra,
              },
            })
            if (action_type === 'salon_detail') markRozySalonDetailBookingBoost(entityId)
          }

          return (
            <div
              key={salon.id}
              className="overflow-hidden rounded-[8px] border border-border bg-card shadow-md"
            >
              <img src={img} alt="" className="aspect-[16/10] w-full object-cover" />
              <div className="space-y-3 p-3 pt-3">
                <div className="text-start">
                  <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">
                    {salon.name_ar}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
                      {ratingLabel}
                    </span>
                    {distLabel ? (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin className="h-3.5 w-3.5 text-primary/80" aria-hidden />
                        {distLabel}
                      </span>
                    ) : null}
                  </div>
                  {suggestedSvc ? (
                    <p className="mt-2 text-start text-xs font-semibold text-primary/95">
                      خدمة مقترحة: {suggestedSvc}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-11 w-full rounded-xl gradient-primary text-white shadow-sm transition-transform active:scale-95"
                    onClick={() => {
                      trackSalon('book', salon.id)
                      goBooking(salon.id, { service_id: preview?.firstServiceId ?? undefined })
                    }}
                  >
                    احجز الآن
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-11 w-full rounded-[4px] border-border text-foreground transition-transform hover:bg-muted/80 active:scale-95"
                    onClick={() => {
                      trackSalon('salon_detail', salon.id)
                      goSalonDetail(salon.id, preview?.firstServiceId)
                    }}
                  >
                    عرض التفاصيل
                  </Button>
                  {canQuickBook && preview?.firstServiceId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="h-11 w-full rounded-[4px] border border-accent/30 bg-accent/10 font-semibold text-foreground transition-transform hover:bg-accent/15 active:scale-95"
                      onClick={() => {
                        trackSalon('book', salon.id, { quick_slot: true })
                        goBooking(salon.id, {
                          service_id: preview.firstServiceId!,
                          booking_date: tomorrowBookingIsoDate(),
                          suggested_slots: ['10:00'],
                          quick: true,
                          initialStep: 3,
                        })
                      }}
                    >
                      {t('aiChat.nearestSlotCta')}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-11 w-full rounded-[4px] border-border text-foreground transition-transform hover:bg-muted/80 active:scale-95"
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
      return <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{row.message}</p>
    }
    return (
      <div className="text-sm leading-relaxed">
        <p className="whitespace-pre-wrap text-foreground">{row.message.slice(0, idx)}</p>
        <div className="mt-3 border-t border-border pt-3">
          <p className="whitespace-pre-wrap text-foreground">{FACE_SCAN_MEDICAL_DISCLAIMER}</p>
        </div>
      </div>
    )
  }

  const renderAssistantAttachments = (row: ChatRow): ReactNode => {
    const hasProducts = Boolean(row.products?.length)
    const hasSalons = Boolean(row.salons?.length)
    const mode = row.recommendationMode
    const traceCtx: RoziChatInteractionCtx = {
      recommendationMode: mode,
      chatMessageId: row.id,
    }

    const salonsFirst =
      mode === 'salon' ||
      mode === 'booking' ||
      mode === 'mixed' ||
      (mode === undefined && hasSalons && !hasProducts)

    const salonCards = hasSalons && row.salons ? renderRosySalonCards(row.salons, traceCtx) : null
    const productCards = hasProducts && row.products ? renderRosyProductCards(row.products, traceCtx) : null

    return (
      <>
        {salonsFirst ? (
          <>
            {salonCards}
            {productCards}
          </>
        ) : (
          <>
            {productCards}
            {salonCards}
          </>
        )}
        {row.actions?.length ? (
          <RosyStructuredAssistant
            salons={hasSalons ? undefined : row.salons}
            actions={row.actions}
            onBookSalon={(id) => {
              if (user?.id) {
                queueRoziEvent({
                  user_id: user.id,
                  action_type: 'book',
                  entity_id: id,
                  recommendation_mode: mode ?? null,
                  metadata: {
                    chat_message_id: row.id,
                    surface: 'structured_salon_card',
                  },
                })
              }
              goBooking(id)
            }}
            onAction={(a) => handleRozyAction(a, traceCtx)}
            recommendationMode={mode}
          />
        ) : null}
      </>
    )
  }

  const renderVoiceUi = (): ReactNode => (
    <>
      {(voiceUi === 'listening' || voiceUi === 'processing') && (
        <div
          className="max-h-16 w-full overflow-y-auto rounded-[4px] border border-border bg-card/95 px-3 py-2 text-center text-xs font-semibold leading-snug text-foreground shadow-lg backdrop-blur-md"
          dir="rtl"
        >
          {liveTranscript ? liveTranscript : voiceUi === 'processing' ? '⏳ …' : '… استمعي'}
        </div>
      )}
      <VoiceWaveform
        phase={voiceUi === 'speaking' ? 'speaking' : voiceUi === 'listening' ? 'listening' : 'idle'}
        externalStream={voiceCaptureStream}
        dustyRoseRecording={voiceUi === 'listening'}
        className="drop-shadow-[0_0_14px_rgb(244_114_182/0.35)]"
      />
      <div className="relative z-floating flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center">
        {voiceUi === 'listening' && (
          <>
            <motion.span
              className="pointer-events-none absolute inset-[-6px] rounded-full border-2 border-primary/55"
              aria-hidden
              animate={{ opacity: [0.35, 0.95, 0.35], scale: [1, 1.12, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.span
              className="pointer-events-none absolute inset-[-14px] rounded-full border border-primary/35"
              aria-hidden
              animate={{ opacity: [0.15, 0.55, 0.15], scale: [1, 1.22, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
            />
          </>
        )}
        <button
          type="button"
          disabled={
            loading ||
            (voiceUi !== 'listening' && voiceUi !== 'speaking' && (sending || voiceUi === 'processing'))
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
            'relative z-raised flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 touch-manipulation items-center justify-center rounded-full border-2 border-primary bg-card text-primary shadow-[0_6px_22px_rgba(0,0,0,0.45)] transition-transform active:scale-95 disabled:pointer-events-none disabled:opacity-45',
            voiceUi === 'processing' && 'ring-2 ring-primary/45',
            voiceUi === 'speaking' && 'ring-2 ring-primary/60 shadow-[0_0_28px_rgb(244_114_182/0.35)]'
          )}
        >
          {voiceUi === 'processing' ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
          ) : voiceUi === 'speaking' ? (
            <Sparkles className="h-6 w-6 text-primary" aria-hidden />
          ) : (
            <Mic className="h-7 w-7 shrink-0 text-primary" strokeWidth={1.35} aria-hidden />
          )}
        </button>
      </div>
      <p className="pointer-events-none text-center text-[10px] font-medium text-foreground drop-shadow-sm">
        {voiceUi === 'listening'
          ? 'متواصل — اضغطي للإيقاف'
          : voiceUi === 'speaking'
            ? 'روزي تتحدث — اضغطي للقطع'
            : voiceUi === 'processing'
              ? 'روزي تستمع…'
              : 'محادثة صوتية فاخرة'}
      </p>
    </>
  )

  return (
    <div
      className={cn(
        'flex flex-col',
        embedded
          ? 'max-h-[80vh] min-h-0 flex-1 overflow-hidden bg-background'
          : 'luxury-page-canvas pb-[calc(7rem+env(safe-area-inset-bottom,0px)+12px)]'
      )}
    >
      {!embedded && (
        <header className="luxury-screen-header">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-elevated">
                <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-heading-3 font-semibold tracking-wide text-foreground">روزي</h1>
                <p className="text-body-sm font-medium text-foreground">
                  مساعدة الحجز والجمال — نبرة سعودية دافئة
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CartHeaderButton />
            </div>
          </div>
        </header>
      )}

      <div
        ref={scrollRef}
        className={cn(
          'min-h-0 flex-1 touch-pan-y space-y-4 overflow-y-auto overscroll-y-contain scroll-smooth px-4 py-5 [-webkit-overflow-scrolling:touch]',
          embedded ? 'scroll-pb-6' : 'scroll-pb-32'
        )}
      >
        {loading ? (
          <p className="text-center font-medium text-foreground">جاري التحميل...</p>
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
                  <div className="max-w-[min(100%,22rem)] rounded-2xl border border-primary/15 bg-card/95 px-4 py-4 shadow-elevated backdrop-blur-sm">
                    <p className="text-sm font-bold leading-snug text-foreground">{t('aiChat.bookingWelcomeTitle')}</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-foreground">
                      {t('aiChat.bookingWelcomeSub')}
                    </p>
                  </div>
                </div>
                <RosyBookingGuide
                  show
                  onBookSalon={(id) => {
                    if (user?.id) {
                      queueRoziEvent({
                        user_id: user.id,
                        action_type: 'book',
                        entity_id: id,
                        recommendation_mode: null,
                        metadata: { surface: 'booking_guide_welcome' },
                      })
                    }
                    goBooking(id)
                  }}
                />
                <p className="text-center">
                  <Button
                    type="button"
                    variant="link"
                    className="text-sm font-semibold text-primary"
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
                    <div className="max-w-[min(85%,26rem)] rounded-2xl bg-gradient-to-br from-primary to-primary/85 px-4 py-3.5 text-primary-foreground shadow-elevated">
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
                      <div className="rounded-2xl border border-primary/15 bg-card/95 px-4 py-3.5 shadow-elevated backdrop-blur-sm">
                        {row.visionAdvisorResult ? (
                          <div className="space-y-3">
                            <p className="text-xs font-extrabold text-primary">{row.message}</p>
                            <RosyVisionChatResults result={row.visionAdvisorResult} />
                          </div>
                        ) : row.message.trim() === VISION_FAIL_AR ? (
                          <RosyVisionChatResults result={null} />
                        ) : (
                          renderAssistantTextOnly(row)
                        )}
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
                <div className="rounded-2xl border border-primary/15 bg-card/95 px-4 py-3.5 shadow-elevated backdrop-blur-sm">
                  <p className="text-xs font-semibold text-primary">
                    {sendingImage ? 'جاري تحليل البشرة…' : 'روزي تكتب...'}
                  </p>
                  <span className="mt-2 flex gap-1.5" aria-hidden>
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/70 [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/70 [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary/70 [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            <p className="mt-4 text-center text-[11px] font-medium text-foreground">
              صور الوجه تُرسَل للتحليل مؤقتاً فقط ولا تُحفَظ على خوادمنا ولا في سجل المحادثة.
            </p>
          </>
        )}
      </div>

      <Dialog
        open={faceScanOpen}
        onOpenChange={(open) => {
          setFaceScanOpen(open)
          if (!open) {
            setAdvisorMode(null)
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تحليل روزي الذكي</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { mode: 'hand_nail' as const, icon: '🤚', title: 'تحليل اليد', sub: 'اكتشفي أندرتونك وألوان مناكيرك' },
                {
                  mode: 'hair_color' as const,
                  icon: '💆‍♀️',
                  title: 'ألوان الشعر',
                  sub: 'اختاري صبغة تناسب بشرتك',
                },
                {
                  mode: 'haircut' as const,
                  icon: '✂️',
                  title: 'قصة الشعر',
                  sub: 'اعرفي القصة الأنسب لوجهك',
                },
                {
                  mode: 'skin_analysis' as const,
                  icon: '🧴',
                  title: 'تحليل البشرة',
                  sub: 'روتين عناية وتوصيات متخصصة',
                },
              ] as const
            ).map((c) => {
              const selected = advisorMode === c.mode
              return (
                <button
                  key={c.mode}
                  type="button"
                  onClick={() => setAdvisorMode(c.mode)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-2xl border-2 p-3 text-start transition touch-manipulation',
                    selected
                      ? 'border border-primary/40 bg-muted shadow-sm ring-1 ring-primary/20 dark:bg-primary/10 dark:ring-primary/25'
                      : 'border-gray-200 bg-white dark:border-border dark:bg-card',
                  )}
                >
                  <span className="text-xl leading-none" aria-hidden>
                    {c.icon}
                  </span>
                  <span className="text-sm font-bold text-foreground">{c.title}</span>
                  <span className="text-[11px] font-medium leading-snug text-foreground">{c.sub}</span>
                </button>
              )
            })}
          </div>
          {!advisorMode ? (
            <p className="text-center text-xs font-medium text-foreground">اختاري نوع التحليل أولاً</p>
          ) : null}
          <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-foreground/90">
            {FACE_SCAN_MEDICAL_DISCLAIMER}
          </p>
          <p className="text-xs font-medium text-foreground">
            لن نخزّن صورتك: تُستخدم لطلب التحليل فقط ثم تُهمل من الذاكرة.
          </p>
          <div className="flex items-start gap-3 rounded-xl border border-primary/15 bg-rosera-light/80 p-3 dark:bg-muted/30">
            <Checkbox
              id="face-scan-consent"
              checked={faceScanConsent}
              onCheckedChange={(v) => setFaceScanConsent(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="face-scan-consent" className="cursor-pointer text-sm font-semibold leading-snug text-foreground">
              {FACE_SCAN_CONSENT_LABEL}
            </Label>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full gap-2 gradient-primary"
              disabled={!faceScanConsent || !advisorMode}
              onClick={startLiveAfterConsent}
            >
              <Camera className="h-4 w-4" aria-hidden />
              التقاط صورة الآن
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={!faceScanConsent || !advisorMode}
              onClick={startUploadAfterConsent}
            >
              <ImageIcon className="h-4 w-4" aria-hidden />
              رفع صورة من الملفات
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                committedAdvisorModeRef.current = null
                setAdvisorMode(null)
                setFaceScanOpen(false)
              }}
            >
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={liveCameraOpen}
        onOpenChange={(open) => {
          setLiveCameraOpen(open)
          if (!open) {
            stopCamera()
            if (photoPickFromLiveRef.current) return
            committedAdvisorModeRef.current = null
            setAdvisorMode(null)
          }
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
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                photoPickFromLiveRef.current = false
                setLiveCameraOpen(false)
              }}
            >
              إلغاء
            </Button>
            <Button type="button" className="gradient-primary" onClick={() => void captureFromVideo()}>
              التقاط وإرسال
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="gap-1 text-xs sm:text-sm"
              onClick={() => {
                photoPickFromLiveRef.current = true
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

      {embedded ? (
        <div className="relative z-sticky-header shrink-0 border-t border-primary/12 bg-gradient-to-b from-card to-muted/50 dark:from-card dark:to-card">
          <div className="mx-auto flex w-full max-w-[18rem] flex-col items-center gap-2 px-4 pb-2 pt-2">
            {renderVoiceUi()}
          </div>
        </div>
      ) : null}

      {/* z-composer above z-app-nav; bottom offset clears fixed nav hit area */}
      <div
        className={cn(
          'sticky border-t border-primary/12 bg-gradient-to-b from-card to-muted/40 shadow-[0_-8px_32px_-12px_rgb(212_165_165/0.12)] dark:from-card dark:to-card dark:shadow-none',
          embedded
            ? 'bottom-0 z-sticky-section pb-[calc(env(safe-area-inset-bottom,0px)+12px)]'
            : 'z-composer bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] pb-[calc(5.5rem+env(safe-area-inset-bottom,0px)+12px)]'
        )}
      >
        <div
          className={cn(
            'flex gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]',
            embedded && 'touch-manipulation'
          )}
        >
          <button
            type="button"
            onClick={() => chatInputRef.current?.focus()}
            aria-label="روزي"
            className="flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/35 bg-card p-0 shadow-sm transition-transform active:scale-95"
          >
            <img
              src={rozyFabPortrait}
              alt=""
              width={44}
              height={44}
              decoding="async"
              className="h-full w-full object-cover object-center"
            />
          </button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="min-h-[44px] min-w-[44px] shrink-0 touch-manipulation rounded-2xl border border-primary/30 bg-card text-primary"
            aria-label="فتح الكاميرا"
            disabled={loading}
            onClick={openFaceScanFlow}
          >
            <Camera className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className={cn(
              'min-h-[44px] min-w-[44px] shrink-0 touch-manipulation rounded-2xl border border-primary/30 bg-card text-primary',
              (voiceUi === 'listening' || voiceUi === 'speaking') && 'ring-2 ring-primary/45'
            )}
            aria-label="بدء/إيقاف المحادثة الصوتية"
            disabled={loading}
            onClick={() => void toggleVoiceInput()}
          >
            <Mic className="h-4 w-4" aria-hidden />
          </Button>
          <Input
            ref={chatInputRef}
            className="flex-1 touch-manipulation rounded-2xl"
            placeholder="اكتبي لروزي..."
            value={input}
            disabled={loading}
            autoComplete="off"
            enterKeyHint="send"
            inputMode="text"
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => {
              window.setTimeout(() => {
                chatInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
              }, 280)
            }}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void send(input)}
          />
          <Button
            size="icon"
            className="min-h-[44px] min-w-[44px] shrink-0 touch-manipulation rounded-2xl gradient-primary"
            disabled={loading || sending}
            onClick={() => void send(input)}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

    </div>
  )
}
