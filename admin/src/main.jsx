import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import './utils/i18n.js'
import store from './contexts/store.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          // client bilan bir xil uslub: oq karta, holat faqat ikonka rangida
          toastOptions={{
            classNames: {
              toast: "!rounded-2xl !shadow-[0_8px_24px_-8px_rgba(15,23,42,0.18)] !font-[inherit]",
              title: "!font-semibold",
              description: "!text-slate-500",
              success: "[&_[data-icon]]:!text-emerald-500",
              error: "[&_[data-icon]]:!text-red-500",
              warning: "[&_[data-icon]]:!text-amber-500",
              info: "[&_[data-icon]]:!text-blue-500",
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
)
