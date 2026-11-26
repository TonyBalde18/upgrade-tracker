import { Monitor, Moon, Plus, Redo2, Search, Sun, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Kbd } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/Tooltip'
import { redo, undo, useHistory, useTracker } from '@/store/tracker'
import { useUi } from '@/store/ui'
import { SyncIndicator } from './SyncIndicator'
import { useIsViewer } from '@/store/auth'
import type { ThemePref } from '@/lib/model/types'

const NEXT_THEME: Record<ThemePref, ThemePref> = { dark: 'light', light: 'system', system: 'dark' }

export function TopBar() {
  const openPalette = useUi((s) => s.openPalette)
  const setNewUpgradeOpen = useUi((s) => s.setNewUpgradeOpen)
  const theme = useTracker((s) => s.doc.settings.theme)
  const updateSettings = useTracker((s) => s.updateSettings)
  const { canUndo, canRedo } = useHistory()
  const viewer = useIsViewer()

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <header
      data-print-hide
      className="relative z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-bg/80 px-3 backdrop-blur md:gap-3 md:px-5"
    >
      <img
        src={`${import.meta.env.BASE_URL}icon-4.png`}
        alt="Upgrade Tracker"
        className="h-8 w-8 shrink-0 rounded-md md:hidden"
        draggable={false}
      />
      <button
        type="button"
        onClick={() => openPalette()}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-subtle transition-colors hover:border-border-strong hover:text-muted cursor-pointer"
        aria-label="Search customers, upgrades and steps"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 truncate text-left">
          Search<span className="hidden sm:inline"> customers, upgrades, steps</span>…
        </span>
        <Kbd className="hidden md:inline-flex">/</Kbd>
        <Kbd className="hidden md:inline-flex">Ctrl K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <SyncIndicator />
        {!viewer && (
          <>
            <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <Tooltip content="Undo (Ctrl+Z)">
              <Button
                variant="ghost"
                size="icon"
                onClick={undo}
                disabled={!canUndo}
                aria-label="Undo"
                className="hidden sm:inline-flex"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Redo (Ctrl+Shift+Z)">
              <Button
                variant="ghost"
                size="icon"
                onClick={redo}
                disabled={!canRedo}
                aria-label="Redo"
                className="hidden sm:inline-flex"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content={`Theme: ${theme} (click to change)`}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Change theme"
                onClick={() =>
                  updateSettings({ theme: NEXT_THEME[theme] }, `Theme → ${NEXT_THEME[theme]}`, {
                    history: false,
                  })
                }
              >
                <ThemeIcon className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="New upgrade (N)">
              <Button
                variant="primary"
                onClick={() => setNewUpgradeOpen(true)}
                className="ml-1 px-2.5 sm:px-4"
                aria-label="New upgrade"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New upgrade</span>
              </Button>
            </Tooltip>
          </>
        )}
      </div>
    </header>
  )
}
