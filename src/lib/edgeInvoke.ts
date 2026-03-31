/** يستخرج رسالة الخطأ من استجابة Edge Function (حتى عند status غير 2xx) */
export function getEdgeFunctionErrorMessage(error: Error | null, data: unknown): string {
  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const e = (data as { error?: unknown }).error
    if (typeof e === 'string' && e.trim()) return e
  }
  return error?.message?.trim() || 'حدث خطأ في الخادم'
}

/**
 * عند non-2xx، ‎@supabase/functions-js‎ يعيد ‎data: null‎ ويضع ‎Response‎ في ‎error.context‎
 * أو في الحقل ‎response‎ من نتيجة ‎invoke‎ — نقرأ JSON ‎{ error: "..." }‎ من الجسم.
 */
export async function getEdgeFunctionHttpErrorDetail(
  error: unknown,
  invokeResponse?: Response | null
): Promise<string | null> {
  const fromInvoke = invokeResponse instanceof Response ? invokeResponse : null
  const fromContext =
    error &&
    typeof error === 'object' &&
    error !== null &&
    'context' in error &&
    (error as { context: unknown }).context instanceof Response
      ? ((error as { context: Response }).context as Response)
      : null
  const res = fromInvoke ?? fromContext
  if (!res) return null
  try {
    const text = (await res.clone().text()).trim()
    if (!text) return null
    try {
      const j = JSON.parse(text) as { error?: string; message?: string }
      if (typeof j.error === 'string' && j.error.trim()) return j.error.trim()
      if (typeof j.message === 'string' && j.message.trim()) return j.message.trim()
    } catch {
      /* ليس JSON */
    }
    return text.length > 600 ? `${text.slice(0, 600)}…` : text
  } catch {
    return null
  }
}

export type EdgeFunctionErrorPayload = {
  error?: string
  debug?: { phase?: string; detail?: string; reason?: string }
}

/** يقرأ جسم JSON كاملاً من استجابة Edge عند non-2xx (يشمل ‎debug‎ إن وُجد). */
export async function getEdgeFunctionErrorPayload(
  error: unknown,
  invokeResponse?: Response | null,
): Promise<EdgeFunctionErrorPayload | null> {
  const fromInvoke = invokeResponse instanceof Response ? invokeResponse : null
  const fromContext =
    error &&
    typeof error === 'object' &&
    error !== null &&
    'context' in error &&
    (error as { context: unknown }).context instanceof Response
      ? ((error as { context: Response }).context as Response)
      : null
  const res = fromInvoke ?? fromContext
  if (!res) return null
  try {
    const text = (await res.clone().text()).trim()
    if (!text) return null
    const j = JSON.parse(text) as EdgeFunctionErrorPayload
    if (j && typeof j === 'object') return j
  } catch {
    /* ليس JSON */
  }
  return null
}
