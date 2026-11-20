import { NavLink, useLocation, useNavigate } from 'react-router'
import { DropdownMenu } from 'radix-ui'
import { MoreHorizontal } from 'lucide-react'
import { NAV, isActivePath } from './nav'
import { cn } from '@/components/ui/cn'

/** Main views on the bar; the rest under "More". */
const MAIN = ['/', '/timeline', '/week', '/customers']

const item =
  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[0.65rem] font-medium transition-colors'
const menuItem =
  'flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-surface-2'

/** Phones and small tablets: a tab bar at the bottom instead of the sidebar. */
export function BottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const main = NAV.filter((n) => MAIN.includes(n.path))
  const more = NAV.filter((n) => !MAIN.includes(n.path))
  const moreActive = more.some((n) => isActivePath(pathname, n.path))

  return (
    <nav
      data-print-hide
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {main.map((n) => {
        const active = isActivePath(pathname, n.path)
        return (
          <NavLink
            key={n.path}
            to={n.path}
            className={cn(item, active ? 'text-accent-text' : 'text-muted')}
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </NavLink>
        )
      })}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(item, 'cursor-pointer', moreActive ? 'text-accent-text' : 'text-muted')}
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="end"
            sideOffset={8}
            className="ut-pop z-50 min-w-48 rounded-xl border border-border bg-surface p-1 shadow-lift"
          >
            {more.map((n) => (
              <DropdownMenu.Item
                key={n.path}
                className={menuItem}
                onSelect={() => navigate(n.path)}
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </nav>
  )
}
