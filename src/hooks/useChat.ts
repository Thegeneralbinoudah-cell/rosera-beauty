import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { getEdgeFunctionErrorMessage, getEdgeFunctionHttpErrorDetail } from '@/lib/edgeInvoke'

/** Shown before capture, after results, and appended to stored assistant text for image analysis. */
export const FACE_SCAN_MEDICAL_DISCLAIMER =
  '⚠️ تنبيه مهم: هذه التوصيات للمساعدة فقط ولا تغني عن\nاستشارة الطبيب المختص. يُرجى مراجعة طبيب متخصص قبل\nاتخاذ أي قرار علاجي.'

export const FACE_SCAN_CONSENT_LABEL =
  'أوافق على أن هذه التوصيات للمساعدة فقط وليست تشخيصاً طبياً'

export function appendMedicalDisclaimerToReply(reply: string): string {
  const t = reply.trim()
  if (!t) return FACE_SCAN_MEDICAL_DISCLAIMER
  if (t.includes(FACE_SCAN_MEDICAL_DISCLAIMER)) return t
  return `${t}\n\n${FACE_SCAN_MEDICAL_DISCLAIMER}`
}

export type ChatRow = { id: string; message: string; is_user: boolean; created_at: string }

export type RoziBookingAction = {
  action: 'booking'
  salon_id: string
  service_id?: string | null
  booking_date?: string | null
  suggested_slots?: string[]
}

export type RoziBrainPayload = {
  reply?: string
  error?: string
  brain?: { intent: string; entities: Record<string, unknown> }
  action?: RoziBookingAction | null
}

export type UseChatOptions = {
  /** When Edge returns a structured booking action, e.g. navigate to `/booking/:salonId`. */
  onBookingAction?: (action: RoziBookingAction) => void
}

type ApiMsg = { role: 'user' | 'assistant'; content: string }

const WELCOME_ROW: ChatRow = {
  id: 'welcome',
  message:
    'مرحباً! أنا روزي — عقل روزيرا (Rosy Brain). أساعدكِ بالعربية: اختيار صالون، خدمات، حجز، ومنتجات. كيف أخدمكِ؟',
  is_user: false,
  created_at: new Date().toISOString(),
}

function mapRowsFromDb(
  data: { id: string; message?: string; response?: string; is_user?: boolean; created_at: string }[] | null
): ChatRow[] {
  return (data ?? []).map((r) => ({
    id: r.id,
    message: r.is_user ? (r.message || '') : (r.response || r.message || ''),
    is_user: r.is_user ?? true,
    created_at: r.created_at,
  }))
}

type ChatMessageInsert = {
  user_id: string
  message: string
  response?: string
  is_user: boolean
  rosey_intent?: string | null
  rosey_entities?: Record<string, unknown>
  rosey_action?: RoziBookingAction | null
}

/**
 * Rosy Brain: history from `chat_messages`; replies + intent + DB context from Edge `rozi-chat`.
 */
export function useChat(userId: string | undefined, options?: UseChatOptions) {
  const { onBookingAction } = options ?? {}
  const [messages, setMessages] = useState<ChatRow[]>([])
  const [loading, setLoading] = useState(true)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const messagesRef = useRef<ChatRow[]>([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const reloadHistory = useCallback(async () => {
    if (!userId) {
      setMessages([])
      setHistoryError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setHistoryError(null)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('id, message, response, is_user, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      setMessages([])
      setHistoryError('تعذر تحميل المحادثة. تحققي من الاتصال وحاولي مجدداً.')
      setLoading(false)
      return
    }

    const rows = mapRowsFromDb(data)
    setMessages(rows.length === 0 ? [WELCOME_ROW] : rows)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void reloadHistory()
  }, [reloadHistory])

  const sendMessage = useCallback(
    async (text: string, image?: { base64: string; mime: string } | null) => {
      const msg = text.trim()
      if (!msg && !image) return
      if (!userId) return

      const displayText = image ? (msg || 'صورة للتحليل (لا تُحفظ)') : msg
      const userRow: ChatRow = {
        id: crypto.randomUUID(),
        message: displayText,
        is_user: true,
        created_at: new Date().toISOString(),
      }

      const priorRows = [...messagesRef.current.filter((m) => m.id !== 'welcome'), userRow]
      setMessages((m) => [...m, userRow])

      const { error: insUserErr } = await supabase.from('chat_messages').insert({
        user_id: userId,
        message: displayText,
        is_user: true,
      })
      if (insUserErr) {
        toast.error('تعذر حفظ رسالتكِ. حاولي مرة أخرى.')
        setMessages((m) => m.filter((x) => x.id !== userRow.id))
        return
      }

      setSending(true)
      try {
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

        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
        const accessToken = refreshed.session?.access_token
        if (refreshErr || !accessToken) {
          const { error: authErr } = await supabase.auth.getUser()
          toast.error(
            authErr
              ? 'انتهت صلاحية الجلسة أو تعذر التحقق منها. سجّلي دخولكِ مرة أخرى.'
              : 'تعذر تجديد الجلسة لروزي. سجّلي خروجاً ثم دخولاً من جديد.'
          )
          return
        }

        const { data, error, response: fnResponse } = await supabase.functions.invoke('rozi-chat', {
          body: {
            messages: apiHistory,
            imageBase64: image?.base64,
            imageMimeType: image?.mime,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        const payload = data as RoziBrainPayload | null
        let botText: string
        if (payload && typeof payload.reply === 'string' && payload.reply.trim()) {
          botText = payload.reply
        } else if (payload && typeof payload.error === 'string' && payload.error.trim()) {
          botText = `عذراً: ${payload.error}`
        } else if (error) {
          const fromBody = await getEdgeFunctionHttpErrorDetail(error, fnResponse ?? null)
          const hint = fromBody ?? getEdgeFunctionErrorMessage(error as Error, data)
          const generic =
            hint === 'Edge Function returned a non-2xx status code' || hint === 'حدث خطأ في الخادم'
          const jwtHint = /invalid\s*jwt/i.test(hint)
          botText = jwtHint
            ? 'تعذر التحقق من هويتكِ (رمز الجلسة). سجّلي خروجاً ثم دخولاً من جديد، وتأكدي أن تطبيقكِ يشير لنفس مشروع Supabase (VITE_SUPABASE_URL).'
            : generic
              ? 'تعذر الاتصال بروزي الآن. تأكدي من: (1) نشر دالة rozi-chat، (2) سر OPENAI_API_KEY في Edge Functions، (3) تطبيق migration 039 لأعمدة المحادثة إن لزم.'
              : `تعذر الاتصال بروزي: ${hint}`
        } else {
          botText = 'لم أستلم رداً واضحاً — جرّبي صياغة أخرى أو لاحقاً.'
        }

        const messageToStore = image ? appendMedicalDisclaimerToReply(botText) : botText
        const brain = payload?.brain
        const rawAction = payload?.action

        const bookingAction: RoziBookingAction | null =
          rawAction &&
          rawAction.action === 'booking' &&
          typeof rawAction.salon_id === 'string' &&
          rawAction.salon_id.length > 0
            ? {
                action: 'booking',
                salon_id: rawAction.salon_id,
                service_id: rawAction.service_id ?? null,
                booking_date: rawAction.booking_date ?? null,
                suggested_slots: rawAction.suggested_slots,
              }
            : null

        if (bookingAction) {
          onBookingAction?.(bookingAction)
        }

        const botRow: ChatRow = {
          id: crypto.randomUUID(),
          message: messageToStore,
          is_user: false,
          created_at: new Date().toISOString(),
        }
        setMessages((m) => [...m, botRow])

        const insertPayload: ChatMessageInsert = {
          user_id: userId,
          message: messageToStore,
          response: messageToStore,
          is_user: false,
          rosey_intent: brain?.intent ?? null,
          rosey_entities: brain?.entities ?? {},
          rosey_action: bookingAction,
        }

        const { error: insBotErr } = await supabase.from('chat_messages').insert(insertPayload as never)
        if (insBotErr) {
          toast.error('تم استلام الرد لكن تعذر حفظه في السجل.')
        }
      } catch {
        const botRow: ChatRow = {
          id: crypto.randomUUID(),
          message: 'حدث خطأ — حاولي مرة أخرى.',
          is_user: false,
          created_at: new Date().toISOString(),
        }
        setMessages((m) => [...m, botRow])
      } finally {
        setSending(false)
      }
    },
    [userId, onBookingAction]
  )

  return {
    messages,
    loading,
    historyError,
    sending,
    sendMessage,
    reloadHistory,
  }
}
