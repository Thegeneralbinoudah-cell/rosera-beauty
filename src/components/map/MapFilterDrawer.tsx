import { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { MapFilterDrawerCategory } from '@/lib/mapFilterDrawerConfig'

type Props = {
  isOpen: boolean
  config: MapFilterDrawerCategory | null
  selectedOptions: string[]
  onToggleOption: (value: string) => void
  onClearCategory: (categoryId: string) => void
  onClose: () => void
  onApply: (options: string[]) => void
}

export function MapFilterDrawer({
  isOpen,
  config,
  selectedOptions,
  onToggleOption,
  onClearCategory,
  onClose,
  onApply,
}: Props) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !config) return
      if (e.key === 'Escape') onClose()
    },
    [isOpen, config, onClose],
  )

  useEffect(() => {
    if (!isOpen || !config) return
    document.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [isOpen, config, onKeyDown])

  if (typeof document === 'undefined' || !config) return null

  return createPortal(
    <>
      <div
        role="presentation"
        aria-hidden={!isOpen}
        onClick={onClose}
        className={`fixed inset-0 z-[900] bg-black transition-opacity duration-300 ${
          isOpen ? 'pointer-events-auto opacity-40' : 'pointer-events-none opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-filter-drawer-title"
        dir="rtl"
        style={{ transitionDuration: '280ms', transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
        className={`fixed right-0 top-0 z-[1000] flex h-full w-[min(300px,92vw)] flex-col rounded-l-2xl bg-white shadow-2xl transition-transform ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 p-4">
          <h3 id="map-filter-drawer-title" className="font-cairo text-lg font-bold text-gray-900">
            {config.title}
          </h3>
          <button
            type="button"
            onClick={() => onClearCategory(config.id)}
            className="font-cairo text-sm font-semibold text-pink-600 transition hover:text-pink-700"
          >
            مسح الكل
          </button>
        </div>

        <div className="flex flex-1 flex-col space-y-3 overflow-y-auto p-4">
          {config.options.map((opt) => {
            const on = selectedOptions.includes(opt.value)
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onToggleOption(opt.value)}
                className={`font-cairo w-full rounded-xl border-2 px-4 py-3 text-right transition-all ${
                  on
                    ? 'border-pink-500 bg-pink-50 text-pink-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        <div className="flex gap-3 border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onClose}
            className="font-cairo flex-1 rounded-xl border-2 border-gray-300 py-3 font-semibold text-gray-800 transition hover:bg-gray-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => onApply(selectedOptions)}
            className="font-cairo flex-1 rounded-xl py-3 font-bold text-white transition-opacity hover:opacity-95"
            style={{
              background: 'linear-gradient(135deg, #E91E8C, #FF6B35)',
            }}
          >
            تطبيق الفلتر
          </button>
        </div>
      </aside>
    </>,
    document.body,
  )
}
