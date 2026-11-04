import { AnimatePresence, motion } from 'motion/react'
import { Route, Routes, useLocation } from 'react-router'
import { lazy, Suspense } from 'react'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { PageSkeleton } from '@/components/ui/PageSkeleton'

const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage'))
const ComingSoon = lazy(() => import('@/features/placeholder/ComingSoon'))

/** Route-level key: /upgrades/a and /upgrades/b animate, query changes do not. */
function routeKey(pathname: string): string {
  return pathname.split('/').slice(0, 3).join('/') || '/'
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
            <Route path="/canvas" element={<ComingSoon view="canvas" />} />
            <Route path="/timeline" element={<ComingSoon view="timeline" />} />
            <Route path="/week" element={<ComingSoon view="week" />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:customerId" element={<CustomersPage />} />
            <Route path="/upgrades/:upgradeId" element={<ComingSoon view="plan" />} />
            <Route path="/template" element={<ComingSoon view="template" />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<ComingSoon view="notfound" />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}
