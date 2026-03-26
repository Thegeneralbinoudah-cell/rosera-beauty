import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CartItem = {
  productId: string
  name_ar: string
  brand_ar?: string
  image_url?: string
  price: number
  quantity: number
}

type CartState = {
  items: CartItem[]
  /** Increments when a **new** product line is added (for cart icon pulse / badge UX). */
  cartUiPulseKey: number
  /** بعد إضافة للسلة — تُستهلك في أول طلب rozi-chat لدفع نحو checkout */
  checkoutNudgePending: boolean
  /** ضغطت «إتمام الطلب» من روزي — يُعاد تعيينه عند أي إضافة للسلة أو إفراغها */
  rosyCheckoutCtaClicked: boolean
  add: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
  markRosyCheckoutCtaClicked: () => void
  /** Force highlight on cart icon (e.g. Rosy flow) even if quantity merged. */
  bumpCartUiPulse: () => void
  /** يعيد true مرة واحدة ثم يصفّر العلم */
  consumeCheckoutNudgePending: () => boolean
  remove: (productId: string) => void
  updateQty: (productId: string, delta: number) => void
  setQty: (productId: string, qty: number) => void
  clear: () => void
  total: () => number
  count: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      cartUiPulseKey: 0,
      checkoutNudgePending: false,
      rosyCheckoutCtaClicked: false,
      markRosyCheckoutCtaClicked: () => set({ rosyCheckoutCtaClicked: true }),
      bumpCartUiPulse: () => set((s) => ({ cartUiPulseKey: s.cartUiPulseKey + 1 })),
      consumeCheckoutNudgePending: () => {
        const pending = get().checkoutNudgePending
        if (pending) set({ checkoutNudgePending: false })
        return pending
      },
      add: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId)
          const qty = (item.quantity ?? 1) + (existing?.quantity ?? 0)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId ? { ...i, quantity: qty } : i
              ),
              checkoutNudgePending: true,
              rosyCheckoutCtaClicked: false,
            }
          }
          return {
            items: [...state.items, { ...item, quantity: item.quantity ?? 1 }],
            cartUiPulseKey: state.cartUiPulseKey + 1,
            checkoutNudgePending: true,
            rosyCheckoutCtaClicked: false,
          }
        }),
      remove: (productId) =>
        set((state) => {
          const items = state.items.filter((i) => i.productId !== productId)
          return {
            items,
            ...(items.length === 0 ? { rosyCheckoutCtaClicked: false } : {}),
          }
        }),
      updateQty: (productId, delta) =>
        set((state) => {
          const next = state.items
            .map((i) => {
              if (i.productId !== productId) return i
              const q = Math.max(0, i.quantity + delta)
              return q === 0 ? null : { ...i, quantity: q }
            })
            .filter(Boolean) as CartItem[]
          return {
            items: next,
            ...(next.length === 0 ? { rosyCheckoutCtaClicked: false } : {}),
          }
        }),
      setQty: (productId, qty) =>
        set((state) => {
          const n = Math.max(0, qty)
          if (n === 0) {
            const items = state.items.filter((i) => i.productId !== productId)
            return {
              items,
              ...(items.length === 0 ? { rosyCheckoutCtaClicked: false } : {}),
            }
          }
          return {
            items: state.items.map((i) =>
              i.productId === productId ? { ...i, quantity: n } : i
            ),
          }
        }),
      clear: () => set({ items: [], rosyCheckoutCtaClicked: false }),
      total: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    {
      name: 'rosera-cart',
      partialize: (s) => ({ items: s.items }),
    }
  )
)
