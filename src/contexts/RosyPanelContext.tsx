import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type RosyPanelContextValue = {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

const RosyPanelContext = createContext<RosyPanelContextValue | null>(null)

export function RosyPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((o) => !o), [])
  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle])
  return <RosyPanelContext.Provider value={value}>{children}</RosyPanelContext.Provider>
}

export function useRosyPanel() {
  const ctx = useContext(RosyPanelContext)
  if (!ctx) throw new Error('useRosyPanel outside RosyPanelProvider')
  return ctx
}
