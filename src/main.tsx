import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { toast } from 'sonner'
// Self-hosted fonts (no Google Fonts requests). Swap here and in theme/brand.ts.
import '@fontsource-variable/inter'
import '@fontsource-variable/montserrat'
import './index.css'
import { injectTokens } from './theme/tokens'
import { hydrateFromCache, startAutoPersist } from './store/persistence'
import { App } from './app/App'

injectTokens()
const hydration = hydrateFromCache()
startAutoPersist()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (!hydration.ok) {
  // Corrupt cache: a copy was kept in storage; tell the user.
  setTimeout(
    () =>
      toast.error('Could not read the saved data in this browser', {
        description: hydration.error,
        duration: 12000,
      }),
    300,
  )
}
