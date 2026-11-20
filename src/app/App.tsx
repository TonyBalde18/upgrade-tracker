import { HashRouter } from 'react-router'
import { MotionConfig } from 'motion/react'
import { Toaster } from 'sonner'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { AnimatedRoutes } from './AnimatedRoutes'
import { CommandPalette } from './CommandPalette'
import { useShortcuts } from './useShortcuts'
import { useAutoStatus } from './useAutoStatus'
import { useAppliedTheme } from './ThemeApplier'
import { AuthGate } from './AuthGate'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { ConfirmHost } from '@/components/ui/confirm'
import { useReducedMotion } from '@/theme/motion'
import { NewUpgradeDialog } from '@/features/plan/NewUpgradeDialog'
import { ExportIcsDialog } from '@/features/ics/ExportIcsDialog'

function Shell() {
  useShortcuts()
  useAutoStatus()
  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="relative min-h-0 flex-1 overflow-auto">
          <AnimatedRoutes />
        </main>
      </div>
      <CommandPalette />
      <NewUpgradeDialog />
      <ExportIcsDialog />
    </div>
  )
}

export function App() {
  const theme = useAppliedTheme()
  const reduced = useReducedMotion()
  return (
    // "always" keeps opacity fades but drops movement, as asked for reduced motion
    <MotionConfig reducedMotion={reduced ? 'always' : 'never'}>
      <TooltipProvider delayDuration={350}>
        <AuthGate>
          {/* Hash routing: deep links and refresh work on GitHub Pages without a 404 page */}
          <HashRouter>
            <Shell />
          </HashRouter>
        </AuthGate>
        <ConfirmHost />
        <Toaster
          theme={theme}
          position="bottom-right"
          toastOptions={{
            className: '!bg-surface !text-text !border-border !shadow-lift',
          }}
        />
      </TooltipProvider>
    </MotionConfig>
  )
}
