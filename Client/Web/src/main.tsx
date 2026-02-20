import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './i18n'
import App from './App.tsx'
import { AlertProvider } from './contexts/AlertContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <BrowserRouter>
        <AlertProvider>
          <App />
        </AlertProvider>
      </BrowserRouter>
    </Suspense>
  </StrictMode>,
)
