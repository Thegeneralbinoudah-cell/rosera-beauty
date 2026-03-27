import { RosyChatPanel } from '@/components/RosyChatPanel'

/** يُحمَّل كسولاً بعد idle — لوحة الدردشة فقط؛ زر روزي يُحمَّل فوراً من `main.tsx` */
export function RosyIdleInner() {
  return <RosyChatPanel />
}
