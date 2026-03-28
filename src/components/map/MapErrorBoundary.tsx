import { Component, type ErrorInfo, type ReactNode } from 'react'
import { MapPinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { colors } from '@/theme/colors'

type Props = { children: ReactNode; fallback?: ReactNode }

type State = { error: Error | null }

/**
 * يعزل أعطال الخريطة (Google Maps / WebGL) عن بقية الصفحة.
 */
export class MapErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MapErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return <MapFallback onRetry={() => this.setState({ error: null })} />
    }
    return this.props.children
  }
}

export function MapFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-b to-white px-6 py-12 text-center dark:from-card dark:to-rosera-dark"
      style={{ backgroundImage: `linear-gradient(to bottom, ${colors.surface}, white)` }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/25">
        <MapPinOff className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <div className="max-w-sm space-y-2">
        <p className="text-base font-bold text-foreground">تعذّر تحميل الخريطة</p>
        <p className="text-sm text-foreground">جرّبي مرة ثانية أو تحديثي الصفحة.</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {onRetry ? (
          <Button type="button" variant="default" className="rounded-2xl" onClick={onRetry}>
            إعادة المحاولة
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="rounded-2xl" onClick={() => window.location.reload()}>
          تحديث الصفحة
        </Button>
      </div>
    </div>
  )
}
