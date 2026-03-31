/** Unified vision prompts + resilient JSON envelope parsing (advisor + core). */

export const OPENAI_VISION_SYSTEM_PROMPT = `You are a professional beauty AI.
You MUST return ONLY valid JSON.
No text, no explanation.
The JSON must match this exact structure:

{
  "summary": string,
  "details": string,
  "recommendations": string[]
}

If you cannot analyze, still return valid JSON with empty values.`

export const OPENAI_VISION_USER_PROMPT = 'Analyze this image and return the result in JSON.'

export type VisionEnvelopeJson = {
  summary: string
  details: string
  recommendations: string[]
}

/** Logs raw text, never throws; always returns a valid envelope object. */
export function parseVisionEnvelope(rawText: string, logLabel: string): VisionEnvelopeJson {
  const raw = typeof rawText === 'string' ? rawText.trim() : ''
  console.log(`[${logLabel}] raw text before JSON.parse:`, raw)
  if (!raw) {
    return { summary: '', details: '', recommendations: [] }
  }
  try {
    const o = JSON.parse(raw) as unknown
    if (!o || typeof o !== 'object' || Array.isArray(o)) {
      return {
        summary: 'analysis unavailable',
        details: raw.slice(0, 8000),
        recommendations: [],
      }
    }
    const r = o as Record<string, unknown>
    const summary = typeof r.summary === 'string' ? r.summary : ''
    const details = typeof r.details === 'string' ? r.details : ''
    const recommendations = Array.isArray(r.recommendations)
      ? r.recommendations.filter((x): x is string => typeof x === 'string')
      : []
    return { summary, details, recommendations }
  } catch {
    return {
      summary: 'analysis unavailable',
      details: raw.slice(0, 8000),
      recommendations: [],
    }
  }
}
