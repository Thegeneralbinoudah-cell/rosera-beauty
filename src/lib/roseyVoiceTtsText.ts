/**
 * Transforms assistant text into Saudi conversational phrasing before ElevenLabs TTS.
 * - Less formal MSA, warmer Gulf/Saudi tone
 * - Shorter sentences + light punctuation for natural pauses
 * Emojis are stripped in `voice.ts` so they are not read aloud.
 */

/** Longer / multi-word patterns first */
const PHRASE_PAIRS: Array<{ re: RegExp; to: string }> = [
  { re: /مرحباً\s*كيف\s*يمكنني\s*مساعدتك\??/gi, to: 'هلا والله، كيف أقدر أخدمك؟' },
  { re: /مرحبا\s*كيف\s*يمكنني\s*مساعدتك\??/gi, to: 'هلا والله، كيف أقدر أخدمك؟' },
  { re: /كيف\s*يمكنني\s*مساعدتك\??/gi, to: 'كيف أقدر أخدمك؟' },
  { re: /كيف\s*يمكنني\s*أن\s*أساعدك\??/gi, to: 'كيف أقدر أساعدك؟' },
  { re: /كيف\s*أساعدك\s*اليوم\??/gi, to: 'كيف أقدر أخدمك اليوم؟' },
  { re: /تم\s*الحجز\s*بنجاح\.?/gi, to: 'تمام، حجزك تأكد' },
  { re: /تم\s*بنجاح/gi, to: 'تمام' },
  { re: /اختر\s*الخدمة/gi, to: 'اختاري الخدمة اللي تناسبك' },
  { re: /يرجى\s*اختيار/gi, to: 'اختاري لو سمحتِ' },
  { re: /يرجى\s*الاختيار/gi, to: 'اختاري لو سمحتِ' },
  { re: /يمكنك\s*الاختيار/gi, to: 'تقدرين تختارين' },
  { re: /هل\s*يمكنني/gi, to: 'أقدر' },
  { re: /شكراً\s*لتواصلك/gi, to: 'شكراً لك، يا بعدي' },
  { re: /شكرا\s*لتواصلك/gi, to: 'شكراً لك، يا بعدي' },
  { re: /عذراً/gi, to: 'آسفة' },
  { re: /أعتذر/gi, to: 'آسفة' },
  { re: /بالتأكيد\.?/gi, to: 'أكيد' },
  { re: /جاري\s*المعالجة/gi, to: 'ثواني، أجهّز لك' },
  { re: /جاري\s*التحميل/gi, to: 'ثواني، نحمّل' },
  { re: /سوف\s*أقوم/gi, to: 'بسوي لك' },
  { re: /يمكنك\s*أن\s*تختاري/gi, to: 'تقدرين تختارين' },
  { re: /يُرجى/gi, to: 'لو سمحتِ' },
  { re: /من\s*فضلكِ/gi, to: 'لو سمحتِ' },
  { re: /من\s*فضلك/gi, to: 'لو سمحتِ' },
  { re: /مرحباً/g, to: 'هلا والله' },
  { re: /مرحبا/g, to: 'هلا والله' },
]

/**
 * Breaks dense paragraphs into shorter spoken units; adds light pauses via punctuation.
 */
function formatConversationalPauses(text: string): string {
  let t = text.replace(/\r\n/g, '\n').trim()
  if (!t) return ''

  t = t.replace(/\n{2,}/g, '. ')
  t = t.replace(/\n/g, '، ')

  const sentences = t.split(/(?<=[.!?؟])\s+/).filter((s) => s.trim().length > 0)
  const chunks: string[] = []

  for (const raw of sentences) {
    const s = raw.trim()
    if (!s) continue
    if (s.length <= 140) {
      chunks.push(s)
      continue
    }
    const atComma = s.split(/،\s+/).filter(Boolean)
    if (atComma.length > 1) {
      chunks.push(atComma.join('، '))
      continue
    }
    const words = s.split(/\s+/)
    let line = ''
    for (const w of words) {
      const next = line ? `${line} ${w}` : w
      if (next.length > 130 && line) {
        chunks.push(line.trim())
        line = w
      } else {
        line = next
      }
    }
    if (line.trim()) chunks.push(line.trim())
  }

  let out = chunks.join('. ')
  out = out.replace(/\s+/g, ' ').replace(/\.\s*\./g, '.').trim()
  return out
}

export function optimizeTextForRosyTts(text: string): string {
  let out = text.trim()
  if (!out) return ''

  for (const { re, to } of PHRASE_PAIRS) {
    out = out.replace(re, to)
  }

  out = formatConversationalPauses(out)
  out = out.replace(/\s+/g, ' ').trim()
  return out
}
