import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = { error: Error | null }

/**
 * يمنع «صفحة بيضاء» الصامتة عند أي خطأ React غير مُعالَج.
 */
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Rosera] Root error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="min-h-dvh flex flex-col items-center justify-center gap-4 p-6 text-center"
          style={{ background: 'linear-gradient(135deg, #E91E8C 0%, #9C27B0 100%)' }}
        >
          <p className="text-lg font-bold text-white">حدث خطأ في التطبيق</p>
          <p className="max-w-md text-sm text-white/90">
            افتحي Console في Chrome (F12 → Console) وأرسلي لقطة للخطأ، أو جرّبي تحديث الصفحة.
          </p>
          <button
            type="button"
            className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-[#9B2257] shadow-lg"
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
