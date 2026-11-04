import { motion } from 'motion/react'
import { NavLink, useLocation } from 'react-router'
import { Cloud, HardDrive, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NAV, isActivePath } from './nav'
import { useUi } from '@/store/ui'
import { Tooltip } from '@/components/ui/Tooltip'
import { Kbd } from '@/components/ui/misc'
import { cn } from '@/components/ui/cn'
import { useConnection } from './useConnection'

const ICON_SRC = `${import.meta.env.BASE_URL}icon-4.png`

export function Sidebar() {
  const collapsed = useUi((s) => s.sidebarCollapsed)
  const toggle = useUi((s) => s.toggleSidebar)
  const { pathname } = useLocation()
  const connection = useConnection()

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 68 : 232 }}
      transition={{ type: 'spring', stiffness: 400, damping: 38 }}
      className="relative z-20 flex h-full shrink-0 flex-col border-r border-border bg-surface"
    >
      <div className="flex h-14 items-center gap-3 overflow-hidden px-4">
        <img src={ICON_SRC} alt="" className="h-8 w-8 shrink-0 rounded-md" draggable={false} />
        <motion.span
          animate={{ opacity: collapsed ? 0 : 1 }}
          className="font-heading text-[0.95rem] font-bold tracking-tight whitespace-nowrap"
        >
          Upgrade Tracker
        </motion.span>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-0.5 px-2" aria-label="Main">
        {NAV.map((item) => {
          const active = isActivePath(pathname, item.path)
          const Icon = item.icon
          const link = (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors',
                active ? 'text-text' : 'text-muted hover:bg-surface-2 hover:text-text',
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 -z-0 rounded-lg bg-accent-soft"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                >
                  <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-accent" />
                </motion.span>
              )}
              <Icon
                className={cn('relative h-[18px] w-[18px] shrink-0', active && 'text-accent-text')}
              />
              {!collapsed && <span className="relative truncate">{item.label}</span>}
              {!collapsed && item.goKey && (
                <span className="relative ml-auto hidden gap-0.5 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100">
                  <Kbd>G</Kbd>
                  <Kbd>{item.goKey.toUpperCase()}</Kbd>
                </span>
              )}
            </NavLink>
          )
          return collapsed ? (
            <Tooltip key={item.path} content={item.label} side="right">
              {link}
            </Tooltip>
          ) : (
            link
          )
        })}
      </nav>

      <div className="flex flex-col gap-1 border-t border-border p-2">
        <Tooltip
          content={collapsed ? (connection.mode === 'github' ? 'GitHub mode' : 'Local mode') : ''}
          side="right"
        >
          <NavLink
            to="/settings"
            className="flex h-9 items-center gap-3 rounded-lg px-3 text-xs text-subtle hover:bg-surface-2 hover:text-text"
          >
            {connection.mode === 'github' ? (
              <Cloud className="h-4 w-4 shrink-0" />
            ) : (
              <HardDrive className="h-4 w-4 shrink-0" />
            )}
            {!collapsed && (
              <span className="truncate">
                {connection.mode === 'github'
                  ? `GitHub · ${connection.repo}`
                  : 'Local mode (this browser)'}
              </span>
            )}
          </NavLink>
        </Tooltip>
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 items-center gap-3 rounded-lg px-3 text-xs text-subtle hover:bg-surface-2 hover:text-text cursor-pointer"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4 shrink-0" />
          ) : (
            <PanelLeftClose className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  )
}
