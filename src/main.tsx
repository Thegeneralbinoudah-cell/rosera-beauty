import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import App from './App.tsx'
import { RootErrorBoundary } from '@/components/RootErrorBoundary'
import { GlobalThemeToggle } from '@/components/GlobalThemeToggle'
import { RosyPanelProvider } from '@/contexts/RosyPanelContext'
import { registerSW } from 'virtual:pwa-register'
/** Tajawal عربي فقط — self-host، font-display: swap داخل الحزم */
import '@fontsource/tajawal/arabic-400.css'
import '@fontsource/tajawal/arabic-500.css'
import '@fontsource/tajawal/arabic-700.css'
import '@fontsource/tajawal/arabic-800.css'
import './index.css'
/** PostHog + تتبع المنتج — يُحمَّل مرة واحدة */
import '@/lib/analytics'
import { captureProductEvent } from '@/lib/analytics'
/** تسجيل مستمع beforeinstallprompt قبل أي مكوّن — مشاركة حدث التثبيت */
import '@/lib/pwaInstall'

if (typeof window !== 'undefined') {
  captureProductEvent('app_open', {
    path: window.location.pathname,
  })
}

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

if (import.meta.env.PROD) {
  registerSW({ immediate: true })
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
                <RosyPanelProvider>
                  <App />
                  <GlobalThemeToggle />
                  <Toaster position="top-center" richColors dir="rtl" closeButton visibleToasts={4} />
                </RosyPanelProvider>
              </AuthProvider>
            </PreferencesProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </RootErrorBoundary>
    </StrictMode>
  )
}
