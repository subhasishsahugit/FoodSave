import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppProvider, ThemeProvider, useTheme } from '@/lib/store'
import App from '@/App'
import 'leaflet/dist/leaflet.css'
import '@/index.css'

function ThemedToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'group toast',
          description: 'toast-description',
        },
      }}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppProvider>
        <TooltipProvider delayDuration={200}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <ThemedToaster />
        </TooltipProvider>
      </AppProvider>
    </ThemeProvider>
  </React.StrictMode>,
)