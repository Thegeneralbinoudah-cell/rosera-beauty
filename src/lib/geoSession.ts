/** يُضبط عند نجاح تحديد الموقع — تُستخدم الخريطة لاختيار «الأقرب» افتراضيًا */
export const ROSERA_GEO_OK_KEY = 'rosera:geo:ok'

export function markGeolocationKnown(): void {
  try {
    sessionStorage.setItem(ROSERA_GEO_OK_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function hasGeolocationKnown(): boolean {
  try {
    return sessionStorage.getItem(ROSERA_GEO_OK_KEY) === '1'
  } catch {
    return false
  }
}
