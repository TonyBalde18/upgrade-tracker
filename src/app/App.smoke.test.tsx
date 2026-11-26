// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'
import { useTracker } from '@/store/tracker'
import { buildDemoDoc } from '@/demo/demo-data'
import { emptyDoc } from '@/lib/model/defaults'
import { useUi } from '@/store/ui'
import { useAuth } from '@/store/auth'

// React needs this flag to run act() outside a test renderer
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
// jsdom has no ResizeObserver (React Flow needs one)
if (!('ResizeObserver' in globalThis)) {
  ;(globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

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
// a signed-in user whose data has loaded (Firebase itself is never loaded in tests)
beforeEach(() => {
  useAuth.setState({
    status: 'signedIn',
    user: { uid: 'test-uid', email: 'someone@example.com', name: 'Someone' },
    role: 'owner',
    error: null,
    busy: false,
  })
  useTracker.getState().setHydrated()
})
afterEach(() => {
  cleanup?.()
  cleanup = null
  document.body.innerHTML = ''
})

describe('sign-in gate', () => {
  it('shows the sign-in screen and no data when signed out', async () => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    useAuth.setState({ status: 'signedOut', user: null })
    const { el, root } = await render('#/')
    cleanup = () => root.unmount()
    expect(el.textContent).toContain('Sign in with Google')
    expect(el.textContent).not.toContain('Acme Corp')
  })

  it('shows a sign-in error', async () => {
    useAuth.setState({ status: 'signedOut', user: null, error: 'Pop-up blocked' })
    const { el, root } = await render('#/')
    cleanup = () => root.unmount()
    expect(el.textContent).toContain('Pop-up blocked')
  })

  it('explains when the account has no access', async () => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    useAuth.setState({ status: 'denied' })
    const { el, root } = await render('#/')
    cleanup = () => root.unmount()
    expect(el.textContent).toContain('No access')
    expect(el.textContent).toContain('someone@example.com')
    expect(el.textContent).not.toContain('Acme Corp')
  })

  it('explains when Firebase is not set up', async () => {
    useAuth.setState({ status: 'unconfigured', user: null })
    const { el, root } = await render('#/')
    cleanup = () => root.unmount()
    expect(el.textContent).toContain('Firebase is not set up yet')
  })

  it('shows a view-only user the data without editing controls', async () => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    useAuth.setState({ role: 'viewer' })
    const { el, root } = await render('#/settings')
    cleanup = () => {
      root.unmount()
      useAuth.setState({ role: 'owner' })
    }
    expect(el.textContent).toContain('View only')
    expect(el.textContent).toContain('view-only')
    expect(el.textContent).not.toContain('New upgrade')
    expect(el.textContent).not.toContain('Give view access')
  })

  it('shows the owner the view access section', async () => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    const { el, root } = await render('#/settings')
    cleanup = () => root.unmount()
    expect(el.textContent).toContain('Give view access')
  })

  it('waits for the data before showing the app', async () => {
    useTracker.setState({ hydrated: false })
    const { el, root } = await render('#/')
    cleanup = () => root.unmount()
    expect(el.textContent).toContain('Loading your data')
  })
})

describe('app smoke test', () => {
  it('opens the New upgrade flow', async () => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    const { root } = await render('#/')
    cleanup = () => root.unmount()
    await act(async () => {
      useUi.getState().setNewUpgradeOpen(true)
      await new Promise((r) => setTimeout(r, 50))
    })
    const text = document.body.textContent ?? ''
    expect(text).toContain('New upgrade')
    expect(text).toContain('Globex')
    expect(text).not.toContain('Fabrikam') // inactive customers are hidden
    expect(text).toMatch(/Active: Zurich → Australia/) // customers with an active upgrade are locked
    await act(async () => useUi.getState().setNewUpgradeOpen(false))
  })

  it('opens the calendar export dialog with an event count', async () => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    const { root } = await render('#/')
    cleanup = () => root.unmount()
    await act(async () => {
      useUi.getState().setIcsTarget({ kind: 'upgrade', id: 'demo-upg-1' })
      await new Promise((r) => setTimeout(r, 50))
    })
    const text = document.body.textContent ?? ''
    expect(text).toContain('Export this upgrade to your calendar')
    expect(text).toContain('Windows + milestones')
    expect(text).toContain('Download .ics')
    await act(async () => useUi.getState().setIcsTarget(null))
  })

  it('shows onboarding on first run', async () => {
    useTracker.getState().replaceDoc(emptyDoc())
    const { el, root } = await render('#/')
    cleanup = () => root.unmount()
    expect(el.textContent).toContain('Welcome to Upgrade Tracker')
    expect(el.textContent).toContain('Add your customers')
  })

  it.each([
    '#/',
    '#/settings',
    '#/customers',
    '#/customers/demo-acme',
    '#/upgrades/demo-upg-1',
    '#/upgrades/demo-upg-2?task=demo-globex-step-21',
    '#/upgrades/missing',
    '#/upgrades/demo-upg-1/print',
    '#/print/overview',
    '#/template',
    '#/canvas',
    '#/nope',
  ])('renders %s with demo data', async (hash) => {
    useTracker.getState().replaceDoc(buildDemoDoc())
    const { el, root } = await render(hash)
    cleanup = () => root.unmount()
    expect(el.textContent).toContain('Upgrade Tracker')
    if (hash === '#/') {
      expect(el.textContent).toContain('Acme Corp')
      expect(el.textContent).toContain('Needs attention')
      expect(el.textContent).toContain('Upgrades per month')
    }
    if (hash === '#/print/overview') {
      expect(el.textContent).toContain('Upgrade overview')
      expect(el.textContent).toContain('Windows in the coming months')
    }
    if (hash === '#/settings') expect(el.textContent).toContain('Pending approval')
    if (hash === '#/customers/demo-acme') expect(el.textContent).toContain('Upgrade history')
    if (hash === '#/upgrades/demo-upg-1') {
      const values = Array.from(el.querySelectorAll('input')).map((i) => i.value)
      expect(values).toContain('Go / No-Go call')
      expect(values).toContain('Upgrade Prod to Australia release')
      expect(el.textContent).toContain('Hypercare')
      expect(el.textContent).toContain('Docs & lessons')
      expect(el.textContent).toContain('Go / No-Go')
    }
    if (hash.startsWith('#/upgrades/demo-upg-2')) expect(el.textContent).toContain('N/A')
    if (hash === '#/upgrades/missing') expect(el.textContent).toContain('Upgrade not found')
    if (hash.endsWith('/print')) {
      expect(el.textContent).toContain('Save as PDF')
      expect(el.textContent).toContain('upgrade schedule')
      expect(el.textContent).toContain('PROD window')
    }
    if (hash === '#/template') expect(el.textContent).toContain('Live preview')
    if (hash === '#/timeline') {
      expect(el.textContent).toContain('Global timeline')
      expect(el.textContent).toContain('clash')
    }
  })
})
