// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { useTracker } from '@/store/tracker'
import { buildDemoDoc } from '@/demo/demo-data'
import { emptyDoc } from '@/lib/model/defaults'

// React needs this flag to run act() outside a test renderer
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

async function render(hash: string) {
  window.location.hash = hash
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  await act(async () => {
    root.render(<App />)
  })
  // let lazy routes resolve (wait until the loading skeleton is gone)
  for (let i = 0; i < 60 && (i < 2 || el.querySelector('[aria-busy="true"]')); i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
  }
  return { el, root }
}

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
  document.body.innerHTML = ''
})

describe('app smoke test', () => {
  it('shows onboarding on first run', async () => {
    useTracker.getState().replaceDoc(emptyDoc())
    useTracker.getState().setHydrated()
    const { el, root } = await render('#/')
    cleanup = () => root.unmount()
    expect(el.textContent).toContain('Welcome to Upgrade Tracker')
    expect(el.textContent).toContain('Add your customers')
  })

  it.each(['#/', '#/settings', '#/customers', '#/canvas', '#/nope'])(
    'renders %s with demo data',
    async (hash) => {
      useTracker.getState().replaceDoc(buildDemoDoc())
      const { el, root } = await render(hash)
      cleanup = () => root.unmount()
      expect(el.textContent).toContain('Upgrade Tracker')
      if (hash === '#/') expect(el.textContent).toContain('Acme Corp')
      if (hash === '#/settings') expect(el.textContent).toContain('Customer confirmed start')
    },
  )
})
