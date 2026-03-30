/**
 * Chat Completions: `choices[].message.content` may be a string or (newer API) an array of parts with `text`.
 */
export function openAiAssistantContentToString(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((p) => {
      if (p && typeof p === 'object' && 'text' in p) {
        const t = (p as { text?: unknown }).text
        return typeof t === 'string' ? t : ''
      }
      return ''
    })
    .join('')
}
