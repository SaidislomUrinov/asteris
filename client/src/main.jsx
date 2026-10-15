import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './utils/i18n.js'
import store from './contexts/store.js'
import App from './App.jsx'
import AppToaster from './components/AppToaster.jsx'

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
