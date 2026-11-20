import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (no Google Fonts requests). Swap here and in theme/brand.ts.
import '@fontsource-variable/inter'
import '@fontsource-variable/montserrat'
import './index.css'
import { injectTokens } from './theme/tokens'
import { removeRetiredKeys } from './lib/storage/local'
import { startAuth } from './store/auth'
import { App } from './app/App'

injectTokens()
removeRetiredKeys()
void startAuth()

// Installable app + opens offline (production only: the dev server must never be cached)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* not available (e.g. private window): the app works the same without it */
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
