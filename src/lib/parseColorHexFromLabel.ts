/** Extract first #RRGGBB or #RGB from a beauty color line (Arabic label + hex). */
export function parseHexFromColorLabel(text: string): string | undefined {
  const m = text.match(/#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/)
  return m ? (m[0].length === 4 ? expandShortHex(m[0]) : m[0]) : undefined
}

function expandShortHex(short: string): string {
  const h = short.slice(1)
  if (h.length !== 3) return short
  const r = h[0] + h[0]
  const g = h[1] + h[1]
  const b = h[2] + h[2]
  return `#${r}${g}${b}`
}

/** Fallback tint when no hex — stable warm neutral from string hash */
export function fallbackTintFromString(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const hue = 320 + (h % 36)
  const sat = 42 + (h % 18)
  const light = 72 + (h % 12)
  return `hsl(${hue} ${sat}% ${light}%)`
}
