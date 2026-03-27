import { useSyncExternalStore } from 'react'

function subscribeToMediaQuery(query: string, onChange: () => void) {
  const mq = window.matchMedia(query)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getMediaSnapshot(query: string) {
  return window.matchMedia(query).matches
}

function getServerSnapshot() {
  return false
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribeToMediaQuery(query, onStoreChange),
    () => getMediaSnapshot(query),
    getServerSnapshot
  )
}
