import { Link } from 'react-router'
import { CalendarDays, Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

const VIEWS = {
  week: { icon: <CalendarDays />, title: 'My week', phase: 5 },
  notfound: { icon: <Compass />, title: 'Page not found', phase: 0 },
} as const

export default function ComingSoon({ view }: { view: keyof typeof VIEWS }) {
  const v = VIEWS[view]
  return (
    <div className="p-8">
      <EmptyState
        icon={v.icon}
        title={v.phase ? `${v.title} arrives in phase ${v.phase}` : v.title}
        body={
          v.phase
            ? 'The foundation is in place. This screen is built in a later phase.'
            : 'This link does not lead anywhere.'
        }
        actions={
          <Link to="/">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />
    </div>
  )
}
