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
  add: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void
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
      add: (item) => set((state) => {
        const existing = state.items.find((i) => i.productId === item.productId)
        const qty = (item.quantity ?? 1) + (existing?.quantity ?? 0)
        if (existing) {
          return {
            items: state.items.map((i) =>
              i.productId === item.productId ? { ...i, quantity: qty } : i
            ),
          }
        }
        return { items: [...state.items, { ...item, quantity: item.quantity ?? 1 }] }
      }),
      remove: (productId) => set((state) => ({
        items: state.items.filter((i) => i.productId !== productId),
      })),
      updateQty: (productId, delta) => set((state) => {
        const next = state.items.map((i) => {
          if (i.productId !== productId) return i
          const q = Math.max(0, i.quantity + delta)
          return q === 0 ? null : { ...i, quantity: q }
        }).filter(Boolean) as CartItem[]
        return { items: next }
      }),
      setQty: (productId, qty) => set((state) => {
        const n = Math.max(0, qty)
        if (n === 0) return { items: state.items.filter((i) => i.productId !== productId) }
        return {
          items: state.items.map((i) =>
            i.productId === productId ? { ...i, quantity: n } : i
          ),
        }
      }),
      clear: () => set({ items: [] }),
      total: () => get().items.reduce((s, i) => s + i.price * i.quantity, 0),
      count: () => get().items.reduce((s, i) => s + i.quantity, 0),
    }),
    { name: 'rosera-cart' }
  )
)
