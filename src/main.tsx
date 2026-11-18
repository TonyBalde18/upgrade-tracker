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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
