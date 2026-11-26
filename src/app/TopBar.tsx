import { motion } from 'motion/react'
import { NavLink, useLocation, useNavigate } from 'react-router'
import { DropdownMenu } from 'radix-ui'
import {
  LogOut,
  Monitor,
  Moon,
  Plus,
  Redo2,
  Rows3,
  Search,
  Settings as SettingsIcon,
  Sun,
  Undo2,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Kbd } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/components/ui/cn'
import { redo, undo, useHistory, useTracker } from '@/store/tracker'
import { useUi } from '@/store/ui'
import { useAuth, useIsViewer } from '@/store/auth'
import type { ThemePref } from '@/lib/model/types'
import { SyncIndicator } from './SyncIndicator'
import { NAV, isActivePath } from './nav'
import { confirmSignOut } from './actions'

const NEXT_THEME: Record<ThemePref, ThemePref> = { dark: 'light', light: 'system', system: 'dark' }
const ICON_SRC = `${import.meta.env.BASE_URL}icon-4.png`
/** Settings lives in the account menu on larger screens, so the bar keeps the views. */
const BAR_NAV = NAV.filter((n) => n.path !== '/settings')

const menuItem =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-2'

/**
 * The only bar: logo, the main views, search and the actions. On phones the views
 * move to the bottom tab bar (BottomNav).
 */
export function TopBar() {
  const openPalette = useUi((s) => s.openPalette)
  const setNewUpgradeOpen = useUi((s) => s.setNewUpgradeOpen)
  const compact = useUi((s) => s.compact)
  const toggleCompact = useUi((s) => s.toggleCompact)
  const theme = useTracker((s) => s.doc.settings.theme)
  const updateSettings = useTracker((s) => s.updateSettings)
  const { canUndo, canRedo } = useHistory()
  const viewer = useIsViewer()
  const user = useAuth((s) => s.user)
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  return (
    <header
      data-print-hide
      className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur md:gap-3 md:px-4"
    >
      <NavLink to="/" className="flex shrink-0 items-center gap-2" aria-label="Dashboard">
        <img src={ICON_SRC} alt="" className="h-8 w-8 rounded-md" draggable={false} />
        <span className="hidden font-heading text-[0.95rem] font-bold tracking-tight whitespace-nowrap 2xl:inline">
          Upgrade Tracker
        </span>
      </NavLink>

      <nav className="hidden items-center gap-0.5 md:flex" aria-label="Main">
        {BAR_NAV.map((item) => {
          const active = isActivePath(pathname, item.path)
          const Icon = item.icon
          return (
            <Tooltip
              side="bottom"
              key={item.path}
              content={
                item.goKey ? `${item.label} (G then ${item.goKey.toUpperCase()})` : item.label
              }
            >
              <NavLink
                to={item.path}
                aria-label={item.label}
                className={cn(
                  'relative flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm transition-colors',
                  active ? 'text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-lg bg-accent-soft"
                    transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  >
                    <span className="absolute right-2 bottom-0 left-2 h-[2px] rounded-full bg-accent" />
                  </motion.span>
                )}
                <Icon className={cn('relative h-4 w-4 shrink-0', active && 'text-accent-text')} />
                <span className="relative hidden whitespace-nowrap lg:inline">{item.label}</span>
              </NavLink>
            </Tooltip>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={() => openPalette()}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm text-subtle transition-colors hover:border-border-strong hover:text-muted md:ml-auto md:max-w-56 md:flex-none xl:max-w-72 cursor-pointer"
        aria-label="Search customers, upgrades and steps"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Search…</span>
        <Kbd className="hidden xl:inline-flex">Ctrl K</Kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <SyncIndicator />
        {!viewer && (
          <>
            <Tooltip side="bottom" content="Undo (Ctrl+Z)">
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
            <Tooltip side="bottom" content="Redo (Ctrl+Shift+Z)">
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
            <Tooltip side="bottom" content="New upgrade (N)">
              <Button
                variant="primary"
                onClick={() => setNewUpgradeOpen(true)}
                className="px-2.5 lg:px-4"
                aria-label="New upgrade"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden lg:inline">New upgrade</span>
              </Button>
            </Tooltip>
          </>
        )}

        <DropdownMenu.Root>
          <Tooltip side="bottom" content={user?.email ? `Signed in as ${user.email}` : 'Account'}>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Account and display">
                <UserRound className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="ut-pop z-50 min-w-60 rounded-xl border border-border bg-surface p-1 shadow-lift"
            >
              <div className="px-3 py-2">
                <div className="truncate text-sm font-medium">{user?.name || 'Signed in'}</div>
                <div className="truncate text-xs text-subtle">{user?.email}</div>
              </div>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item className={menuItem} onSelect={() => navigate('/settings')}>
                <SettingsIcon className="h-4 w-4" /> Settings
              </DropdownMenu.Item>
              {!viewer && (
                <DropdownMenu.Item
                  className={menuItem}
                  onSelect={() =>
                    updateSettings({ theme: NEXT_THEME[theme] }, `Theme → ${NEXT_THEME[theme]}`, {
                      history: false,
                    })
                  }
                >
                  <ThemeIcon className="h-4 w-4" /> Theme: {theme}
                </DropdownMenu.Item>
              )}
              <DropdownMenu.CheckboxItem
                className={menuItem}
                checked={compact}
                onCheckedChange={toggleCompact}
              >
                <Rows3 className="h-4 w-4" /> Compact rows
                <span className="ml-auto text-xs text-subtle">{compact ? 'On' : 'Off'}</span>
              </DropdownMenu.CheckboxItem>
              <DropdownMenu.Separator className="my-1 h-px bg-border" />
              <DropdownMenu.Item
                className={cn(menuItem, 'text-danger')}
                onSelect={() => void confirmSignOut()}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  )
}
