import { supabase } from '@/lib/supabase'
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

export const VISION_FAIL_AR = 'عذراً، حدث خطأ في التحليل. حاولي مجدداً 🌸'

const ROZY_VISION_INVOKE_TIMEOUT_MS = 120_000

/**
 * يستدعي `rozi-vision` مع أي وضع مدعوم ويُرجع اتحاداً مميزاً حسب `mode`.
 * على أي فشل يُرمى خطأ برسالة `VISION_FAIL_AR` فقط.
 */
export async function invokeRozyAdvisor(
  mode: RozyAdvisorMode,
  base64: string,
  mimeType: string,
): Promise<RozyVisionChatResult> {
  try {
    if (base64.length > MAX_ROZY_VISION_BASE64_CHARS) {
      throw new Error(VISION_FAIL_AR)
    }

    const { data: sess } = await supabase.auth.refreshSession()
    const token = sess.session?.access_token
    if (!token) {
      throw new Error(VISION_FAIL_AR)
    }

    const { data, error } = await supabase.functions.invoke('rozi-vision', {
      body: {
        mode,
        imageBase64: base64,
        imageMimeType: mimeType?.trim() || 'image/jpeg',
      },
      headers: { Authorization: `Bearer ${token}` },
      timeout: ROZY_VISION_INVOKE_TIMEOUT_MS,
    })

    if (error) {
      throw new Error(VISION_FAIL_AR)
    }

    const pack = data as { result?: unknown; advisor_result?: unknown; error?: string } | null
    if (pack?.error) {
      throw new Error(VISION_FAIL_AR)
    }

    if (mode === 'hand' || mode === 'face') {
      if (!pack?.result || typeof pack.result !== 'object') {
        throw new Error(VISION_FAIL_AR)
      }
      const result = normalizeRozyVisionResult(pack.result, mode as RozyVisionMode)
      return mode === 'hand' ? { mode: 'hand', result } : { mode: 'face', result }
    }

    if (!pack?.advisor_result || typeof pack.advisor_result !== 'object') {
      throw new Error(VISION_FAIL_AR)
    }

    const ar = pack.advisor_result as { advisor_mode?: string }

    if (mode === 'hair_color') {
      if (ar.advisor_mode !== 'hair_color') {
        throw new Error(VISION_FAIL_AR)
      }
      return {
        mode: 'hair_color',
        advisor_result: pack.advisor_result as HairColorAdvisorResult,
      }
    }

    if (mode === 'haircut') {
      if (ar.advisor_mode !== 'haircut') {
        throw new Error(VISION_FAIL_AR)
      }
      return {
        mode: 'haircut',
        advisor_result: pack.advisor_result as HaircutAdvisorResult,
      }
    }

    if (mode === 'hand_nail') {
      if (ar.advisor_mode !== 'hand_nail') {
        throw new Error(VISION_FAIL_AR)
      }
      return {
        mode: 'hand_nail',
        advisor_result: pack.advisor_result as HandNailAdvisorResult,
      }
    }

    if (mode === 'skin_analysis') {
      if (ar.advisor_mode !== 'skin_analysis') {
        throw new Error(VISION_FAIL_AR)
      }
      return {
        mode: 'skin_analysis',
        advisor_result: pack.advisor_result as SkinAnalysisAdvisorResult,
      }
    }

    throw new Error(VISION_FAIL_AR)
  } catch {
    throw new Error(VISION_FAIL_AR)
  }
}
