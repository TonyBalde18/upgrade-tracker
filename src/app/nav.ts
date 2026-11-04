import {
  Building2,
  CalendarDays,
  ChartGantt,
  LayoutDashboard,
  ListChecks,
  Settings,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  path: string
  label: string
  icon: LucideIcon
  /** second key of the "G x" shortcut */
  goKey?: string
}

export const NAV: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, goKey: 'd' },
  { path: '/canvas', label: 'Canvas', icon: Workflow, goKey: 'c' },
  { path: '/timeline', label: 'Timeline', icon: ChartGantt, goKey: 't' },
  { path: '/week', label: 'My week', icon: CalendarDays, goKey: 'w' },
  { path: '/customers', label: 'Customers', icon: Building2 },
  { path: '/template', label: 'Template', icon: ListChecks },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export function isActivePath(current: string, item: string): boolean {
  if (item === '/') return current === '/'
  return current === item || current.startsWith(item + '/')
}
