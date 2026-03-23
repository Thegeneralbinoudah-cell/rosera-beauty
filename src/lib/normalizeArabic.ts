/**
 * تطبيع مدخلات اللهجة السعودية قبل إرسالها لروزي (تحسين الفهم دون تغيير منطق الـ Edge بالكامل).
 */
export function normalizeArabic(text: string): string {
  let t = text.trim()
  if (!t) return t

  const pairs: [RegExp, string][] = [
    [/ابغى/gi, 'أريد'],
    [/ابغا/gi, 'أريد'],
    [/ابي\b/gi, 'أريد'],
    [/ابَي/gi, 'أريد'],
    [/ابغي/gi, 'أريد'],
    [/ودي\b/gi, 'أريد'],
    [/وذي\b/gi, 'أريد'],
    [/اقرب/gi, 'قريب'],
    [/مره\b/gi, 'جدا'],
    [/مرّة/g, 'جدا'],
    [/شوي\b/gi, 'قليلا'],
    [/شوية\b/gi, 'قليلا'],
    [/زين\b/gi, 'جيد'],
    [/حلو\b/gi, 'جيد'],
  ]

  for (const [re, rep] of pairs) {
    t = t.replace(re, rep)
  }

  return t.replace(/\s+/g, ' ').trim()
}
