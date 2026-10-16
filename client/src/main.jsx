import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { initSavedLanguage } from './utils/i18n.js'
import store from './contexts/store.js'
import App from './App.jsx'
import AppToaster from './components/AppToaster.jsx'

// Yangi deploy'dan keyin eski tab ochiq qolsa, lazy sahifa chunk'i (eski
// hash) serverda bo'lmaydi va import xato beradi — sahifa bir marta
// yangilanadi (yangi index.html yangi chunk'larni oladi). 10 soniya ichida
// qayta xato bo'lsa — cheksiz reload bo'lmasligi uchun to'xtaydi.
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('chunkReloadAt') || 0)
    if (Date.now() - last < 10000) return
    sessionStorage.setItem('chunkReloadAt', String(Date.now()))
  } catch {
    // sessionStorage yo'q — baribir bir marta yangilaymiz
  }
  event.preventDefault()
  window.location.reload()
})

const render = () =>
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Provider store={store}>
        <BrowserRouter>
          <App />
          <AppToaster />
        </BrowserRouter>
      </Provider>
    </StrictMode>,
  )

// Saqlangan til (ru/uzc/en) alohida chunk — u yuklanmaguncha render
// qilinmaydi, aks holda bir lahza uz matnlari ko'rinib qolardi.
const bootstrap = async () => {
  try {
    await initSavedLanguage()
  } finally {
    render()
  }
}
bootstrap()
