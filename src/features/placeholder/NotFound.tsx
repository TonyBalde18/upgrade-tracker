import { Link } from 'react-router'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

/** Shown for links that do not lead anywhere. */
export default function NotFound() {
  return (
    <div className="p-8">
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        body="This link does not lead anywhere."
        actions={
          <Link to="/">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />
    </div>
  )
}
