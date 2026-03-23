import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import App from './App.tsx'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'
import './index.css'

/** في التطوير: إلغاء تسجيل أي Service Worker قد يعترض طلبات Vite ويُسبب «Failed to fetch dynamically imported module» */
if (import.meta.env.DEV && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) void r.unregister()
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
      gcTime: 5 * 60_000,
    },
  },
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/rosera-sw.js').catch(() => {})
  })
}

const rootEl = document.getElementById('root')
if (!rootEl) {
  document.body.innerHTML = '<p style="padding:2rem;font-family:sans-serif">Missing #root</p>'
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <PreferencesProvider>
              <AuthProvider>
                <App />
                <Toaster position="top-center" richColors dir="rtl" />
              </AuthProvider>
            </PreferencesProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </RootErrorBoundary>
    </StrictMode>
  )
}
