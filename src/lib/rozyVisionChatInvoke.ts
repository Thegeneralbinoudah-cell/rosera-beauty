import { supabase } from '@/lib/supabase'
import {
  getEdgeFunctionErrorMessage,
  getEdgeFunctionErrorPayload,
  getEdgeFunctionHttpErrorDetail,
} from '@/lib/edgeInvoke'
import { normalizeRozyVisionResult, MAX_ROZY_VISION_BASE64_CHARS } from '@/lib/rozyVision'
import type { RozyVisionMode } from '@/lib/rozyVisionTypes'
import type {
  HairColorAdvisorResult,
  HaircutAdvisorResult,
  HandNailAdvisorResult,
  RozyAdvisorMode,
  RozyVisionChatResult,
  SkinAnalysisAdvisorResult,
} from '@/lib/rozyVisionChatTypes'

export const VISION_FAIL_AR = 'عذراً، حدث خطأ في التحليل. حاولي مجدداً.'

const ROZY_VISION_INVOKE_TIMEOUT_MS = 120_000

export type RozyVisionEdgeDebug = { phase?: string; detail?: string; reason?: string }

/** رسالة واحدة للعرض المؤقت في فقاعة المحادثة (تشخيص rozi-vision). */
export function formatRoziVisionDebugError(edgeError: string, debug: RozyVisionEdgeDebug | null | undefined): string {
  const phase = debug?.phase?.trim() || '—'
  const reason = debug?.reason?.trim() || '—'
  const detail = debug?.detail?.trim() || '—'
  return `[rozi-vision debug]\nphase: ${phase}\nreason: ${reason}\ndetail: ${detail}\nerror: ${edgeError}`
}

function asDebug(x: unknown): RozyVisionEdgeDebug | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  return {
    phase: typeof o.phase === 'string' ? o.phase : undefined,
    detail: typeof o.detail === 'string' ? o.detail : undefined,
    reason: typeof o.reason === 'string' ? o.reason : undefined,
  }
}

/**
 * يستدعي `rozi-vision` مع أي وضع مدعوم ويُرجع اتحاداً مميزاً حسب `mode`.
 * عند الفشل: `console.error` كامل + رمي `Error` برسالة تفصيلية للتشخيص (مؤقتاً).
 */
export async function invokeRozyAdvisor(
  mode: RozyAdvisorMode,
  base64: string,
  mimeType: string,
): Promise<RozyVisionChatResult> {
  try {
    if (base64.length > MAX_ROZY_VISION_BASE64_CHARS) {
      const msg = `[rozyVisionChatInvoke] image base64 too large: ${base64.length} chars (max ${MAX_ROZY_VISION_BASE64_CHARS})`
      console.error(msg)
      throw new Error(
        formatRoziVisionDebugError(msg, {
          phase: 'client',
          reason: 'image_base64_too_large',
          detail: `length=${base64.length}`,
        }),
      )
    }

    const { data: { session } } = await supabase.auth.getSession()
    let token = session?.access_token?.trim() ?? ''
    const now = Math.floor(Date.now() / 1000)
    const exp = session?.expires_at
    const needsRefresh = !token || (typeof exp === 'number' && exp <= now + 30)
    if (needsRefresh) {
      const { data: ref } = await supabase.auth.refreshSession()
      token = ref.session?.access_token?.trim() ?? ''
    }
    console.log('[rozyVisionChatInvoke] access_token present', Boolean(token))
    if (!token) {
      throw new Error(
        formatRoziVisionDebugError(
          'يجب تسجيل الدخول لاستخدام روزي مع الصورة. سجّلي دخولكِ ثم أعيدي المحاولة.',
          { phase: 'client', reason: 'no_access_token' },
        ),
      )
    }

    const { data, error, response: fnResponse } = await supabase.functions.invoke('rozi-vision', {
      body: {
        mode,
        imageBase64: base64,
        imageMimeType: mimeType?.trim() || 'image/jpeg',
      },
      headers: { Authorization: `Bearer ${token}` },
      timeout: ROZY_VISION_INVOKE_TIMEOUT_MS,
    })

    if (error) {
      const payload = await getEdgeFunctionErrorPayload(error, fnResponse ?? null)
      const fromBody = await getEdgeFunctionHttpErrorDetail(error, fnResponse ?? null)
      const hint =
        (typeof payload?.error === 'string' && payload.error.trim() ? payload.error.trim() : null) ??
        fromBody ??
        getEdgeFunctionErrorMessage(error as Error, data)
      console.error('[rozyVisionChatInvoke] functions.invoke failed', {
        error,
        data,
        responseStatus: fnResponse?.status,
        message: hint,
        debug: payload?.debug,
      })
      throw new Error(
        formatRoziVisionDebugError(
          hint || (error instanceof Error ? error.message : String(error)),
          payload?.debug ?? null,
        ),
      )
    }

    const pack = data as {
      result?: unknown
      advisor_result?: unknown
      error?: string
      debug?: unknown
    } | null
    if (pack?.error) {
      const errText =
        typeof pack.error === 'string' ? pack.error : JSON.stringify(pack.error)
      const dbg = asDebug(pack.debug)
      console.error('[roziVisionChatInvoke] rozi-vision body error', { error: pack.error, debug: pack.debug })
      throw new Error(formatRoziVisionDebugError(errText, dbg))
    }

    if (mode === 'hand' || mode === 'face') {
      if (!pack?.result || typeof pack.result !== 'object') {
        const msg = `[rozyVisionChatInvoke] missing or invalid result for mode=${mode}`
        console.error(msg, { pack })
        throw new Error(formatRoziVisionDebugError(msg, asDebug(pack?.debug)))
      }
      const result = normalizeRozyVisionResult(pack.result, mode as RozyVisionMode)
      return mode === 'hand' ? { mode: 'hand', result } : { mode: 'face', result }
    }

    if (!pack?.advisor_result || typeof pack.advisor_result !== 'object') {
      const msg = `[rozyVisionChatInvoke] missing advisor_result for mode=${mode}`
      console.error(msg, { pack })
      throw new Error(formatRoziVisionDebugError(msg, asDebug(pack?.debug)))
    }

    const ar = pack.advisor_result as { advisor_mode?: string }

    if (mode === 'hair_color') {
      if (ar.advisor_mode !== 'hair_color') {
        const msg = `[rozyVisionChatInvoke] advisor_mode mismatch: expected hair_color, got ${String(ar.advisor_mode)}`
        console.error(msg)
        throw new Error(formatRoziVisionDebugError(msg, asDebug(pack?.debug)))
      }
      return {
        mode: 'hair_color',
        advisor_result: pack.advisor_result as HairColorAdvisorResult,
      }
    }

    if (mode === 'haircut') {
      if (ar.advisor_mode !== 'haircut') {
        const msg = `[rozyVisionChatInvoke] advisor_mode mismatch: expected haircut, got ${String(ar.advisor_mode)}`
        console.error(msg)
        throw new Error(formatRoziVisionDebugError(msg, asDebug(pack?.debug)))
      }
      return {
        mode: 'haircut',
        advisor_result: pack.advisor_result as HaircutAdvisorResult,
      }
    }

    if (mode === 'hand_nail') {
      if (ar.advisor_mode !== 'hand_nail') {
        const msg = `[rozyVisionChatInvoke] advisor_mode mismatch: expected hand_nail, got ${String(ar.advisor_mode)}`
        console.error(msg)
        throw new Error(formatRoziVisionDebugError(msg, asDebug(pack?.debug)))
      }
      return {
        mode: 'hand_nail',
        advisor_result: pack.advisor_result as HandNailAdvisorResult,
      }
    }

    if (mode === 'skin_analysis') {
      if (ar.advisor_mode !== 'skin_analysis') {
        const msg = `[rozyVisionChatInvoke] advisor_mode mismatch: expected skin_analysis, got ${String(ar.advisor_mode)}`
        console.error(msg)
        throw new Error(formatRoziVisionDebugError(msg, asDebug(pack?.debug)))
      }
      return {
        mode: 'skin_analysis',
        advisor_result: pack.advisor_result as SkinAnalysisAdvisorResult,
      }
    }

    const msg = `[rozyVisionChatInvoke] unsupported mode branch: ${mode}`
    console.error(msg)
    throw new Error(formatRoziVisionDebugError(msg, null))
  } catch (e) {
    console.error('[rozyVisionChatInvoke] failed', e)
    if (e instanceof Error) throw e
    throw new Error(formatRoziVisionDebugError(String(e), null))
  }
}
