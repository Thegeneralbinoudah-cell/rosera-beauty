import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/contexts/AuthContext'
import { PreferencesProvider } from '@/contexts/PreferencesContext'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/rosera-sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
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
  </StrictMode>
)
