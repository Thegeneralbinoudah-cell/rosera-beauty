const JS_DAY_TO_AR: Record<number, string> = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
}

function parseHm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

function minutesNow(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

export type SalonHoursStatus = {
  isOpen: boolean
  statusLabel: string
  nextLine: string | null
}

/**
 * Uses keys like الأحد / السبت and values { open, close } "HH:MM" (Saudi-style seed data).
 */
export function salonHoursStatus(
  hours: Record<string, { open: string; close: string }> | null | undefined,
  now = new Date()
): SalonHoursStatus {
  if (!hours || typeof hours !== 'object' || Object.keys(hours).length === 0) {
    return {
      isOpen: false,
      statusLabel: 'أوقات غير محددة',
      nextLine: null,
    }
  }

  const todayAr = JS_DAY_TO_AR[now.getDay()]
  const slot = hours[todayAr]
  const nowMin = minutesNow(now)

  if (slot?.open && slot?.close) {
    const o = parseHm(slot.open)
    const c = parseHm(slot.close)
    if (o != null && c != null && c > o) {
      if (nowMin >= o && nowMin < c) {
        return { isOpen: true, statusLabel: 'مفتوح الآن', nextLine: `حتى ${slot.close}` }
      }
      if (nowMin < o) {
        return {
          isOpen: false,
          statusLabel: 'مغلق الآن',
          nextLine: `يفتح اليوم الساعة ${slot.open}`,
        }
      }
    }
  }

  for (let add = 1; add <= 7; add++) {
    const d = new Date(now)
    d.setDate(d.getDate() + add)
    const ar = JS_DAY_TO_AR[d.getDay()]
    const h = hours[ar]
    if (h?.open && h?.close) {
      const o = parseHm(h.open)
      const c = parseHm(h.close)
      if (o != null && c != null && c > o) {
        return {
          isOpen: false,
          statusLabel: 'مغلق الآن',
          nextLine: add === 1 ? `التالي: غداً ${h.open}` : `التالي: ${ar} ${h.open}`,
        }
      }
    }
  }

  return { isOpen: false, statusLabel: 'مغلق الآن', nextLine: null }
}
