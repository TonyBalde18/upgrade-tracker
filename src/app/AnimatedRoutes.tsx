import { AnimatePresence, motion } from 'motion/react'
import { Route, Routes, useLocation } from 'react-router'
import { lazy, Suspense } from 'react'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PageSkeleton } from '@/components/ui/PageSkeleton'

const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage'))
const NotFound = lazy(() => import('@/features/placeholder/NotFound'))
const PlanPage = lazy(() => import('@/features/plan/PlanPage'))
const TemplatePage = lazy(() => import('@/features/template/TemplatePage'))
const TimelinePage = lazy(() => import('@/features/timeline/TimelinePage'))
const CanvasPage = lazy(() => import('@/features/canvas/CanvasPage'))
const WeekPage = lazy(() => import('@/features/week/WeekPage'))
const PrintPlanPage = lazy(() => import('@/features/print/PrintPlanPage'))

/** Route-level key: switching upgrades animates; picking another customer or changing the query does not. */
function routeKey(pathname: string): string {
  const parts = pathname.split('/')
  return (parts[1] === 'upgrades' ? parts.slice(0, 3) : parts.slice(0, 2)).join('/') || '/'
}

export function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey(location.pathname)}
        className="h-full"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Suspense fallback={<PageSkeleton />}>
          <Routes location={location}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/canvas" element={<CanvasPage />} />
            <Route path="/timeline" element={<TimelinePage />} />
            <Route path="/week" element={<WeekPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:customerId" element={<CustomersPage />} />
            <Route path="/upgrades/:upgradeId" element={<PlanPage />} />
            <Route path="/upgrades/:upgradeId/print" element={<PrintPlanPage />} />
            <Route path="/template" element={<TemplatePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}
