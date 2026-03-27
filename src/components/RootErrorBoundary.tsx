import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureProductEvent } from '@/lib/posthog'
import { gradients } from '@/theme/tokens'

type Props = { children: ReactNode }

type State = { error: Error | null }

/** يمنع تكرار نفس حدث التحليلات إن أُعيد استدعاء didCatch (نادراً / إعادة تركيب). */
let lastReactRenderErrorKey: string | null = null
let lastReactRenderErrorAt = 0
const REACT_ERROR_DEDUPE_MS = 2500

/**
 * يمنع «صفحة بيضاء» الصامتة عند أي خطأ React غير مُعالَج.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    try {
      console.error('[RootErrorBoundary]', error, info.componentStack)
      const key = `${(error.message || 'error').slice(0, 200)}:${(error.stack || '').slice(0, 160)}`
      const now = Date.now()
      if (lastReactRenderErrorKey === key && now - lastReactRenderErrorAt < REACT_ERROR_DEDUPE_MS) {
        return
      }
      lastReactRenderErrorKey = key
      lastReactRenderErrorAt = now
      captureProductEvent('react_render_error', {
        message: (error.message || 'error').slice(0, 200),
        stack: (error.stack || '').slice(0, 200),
      })
    } catch {
      /* ignore */
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center"
          style={{ background: gradients.primary }}
        >
          <p className="text-lg font-bold text-white">حدث خطأ في التطبيق</p>
          <p className="max-w-md text-sm text-white/90">
            جرّبي تحديث الصفحة. إذا تكرّر الخطأ، تواصلي مع الدعم مع ذكر الوقت تقريباً.
          </p>
          <button
            type="button"
            className="rounded-full bg-card px-6 py-2 text-sm font-semibold text-primary shadow-lg"
            onClick={() => window.location.reload()}
          >
            إعادة تحميل
          </button>
          {import.meta.env.DEV && (
            <pre className="max-w-full overflow-auto rounded-lg bg-black/30 p-3 text-start text-xs text-white/90">
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
