import { lazy, Suspense, useEffect, useState } from 'react'

const RosyIdleInner = lazy(() =>
  import('@/components/layout/RosyIdleInner').then((m) => ({ default: m.RosyIdleInner }))
)

/**
 * يؤجّل تحميل روزي (FAB + لوحة) إلى ما بعد أول إطار / requestIdleCallback
 * حتى لا يضخّم حزمة المسار الحرج لـ Home وغيرها.
 */
export function RosyLazyMount() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (!cancelled) setShow(true)
    }
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(run, { timeout: 2000 })
      return () => {
        cancelled = true
        cancelIdleCallback(id)
      }
    }
    const t = window.setTimeout(run, 1800)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [])

  if (!show) return null

  return (
    <Suspense fallback={null}>
      <RosyIdleInner />
    </Suspense>
  )
}
