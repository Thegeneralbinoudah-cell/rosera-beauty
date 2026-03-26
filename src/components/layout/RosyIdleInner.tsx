import { RosyFloatingButton } from '@/components/RosyFloatingButton'
import { RosyChatPanel } from '@/components/RosyChatPanel'

/** يُحمَّل كسولاً بعد idle — يخفّض JS في المسار الحرج */
export function RosyIdleInner() {
  return (
    <>
      <RosyFloatingButton />
      <RosyChatPanel />
    </>
  )
}
