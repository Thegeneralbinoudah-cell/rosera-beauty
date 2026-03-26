import { useCallback, useEffect, useState } from 'react'
import {
  clearDeferredInstallPrompt,
  getDeferredInstallPrompt,
  subscribeDeferredInstallPrompt,
} from '@/lib/pwaInstall'

export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(() => Boolean(getDeferredInstallPrompt()))

  useEffect(() => {
    return subscribeDeferredInstallPrompt(() => {
      setCanPrompt(Boolean(getDeferredInstallPrompt()))
    })
  }, [])

  const promptInstall = useCallback(async () => {
    const ev = getDeferredInstallPrompt()
    if (!ev) return { outcome: 'unavailable' as const }
    await ev.prompt()
    const { outcome } = await ev.userChoice
    clearDeferredInstallPrompt()
    return outcome === 'accepted' ? ({ outcome: 'accepted' } as const) : ({ outcome: 'dismissed' } as const)
  }, [])

  return { canPrompt, promptInstall }
}
