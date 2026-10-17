import { createBrowserRouter, Navigate, useLocation, useRouteError, isRouteErrorResponse } from 'react-router'
import Landing from './pages/Landing'
import { Login, Signup } from './pages/Auth'
import Onboarding from './pages/Onboarding'
import Shell, { RoleOnly } from './pages/Shell'
import { NotFoundState, Btn, Card } from './ui'
import { getToken, IS_DEMO_MODE } from './api'
import Clients from './pages/specialist/Clients'
import ClientDetail from './pages/specialist/ClientDetail'
import Schedule from './pages/specialist/Schedule'
import Overview from './pages/admin/Overview'
import Users from './pages/admin/Users'
import Approvals from './pages/admin/Approvals'
import { Today } from './pages/AppPages'
import { SpecialistsList, SpecialistProfile } from './pages/client/Specialists'
import Booking from './pages/client/Booking'
import Bookings from './pages/client/Bookings'
import Checkout from './pages/client/Checkout'
import Plan from './pages/client/Plan'
import Progress from './pages/client/Progress'
import AiPlan from './pages/client/AiPlan'
import Session from './pages/client/Session'
import FinanceOverview from './pages/finance/Overview'
import FinanceTransactions from './pages/finance/Transactions'
import FinancePayouts from './pages/finance/Payouts'
import FinanceSubscriptions from './pages/finance/Subscriptions'

const NotFound = () => <NotFoundState full />
const only = (role: 'Client' | 'Specialist' | 'Admin' | 'Finance', C: () => React.JSX.Element) => () => <RoleOnly role={role}><C /></RoleOnly>

export function RouteErrorBoundary() {
  const error = useRouteError()
  const msg = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
    ? error.message
    : 'An unexpected application error occurred'

  return (
    <div className="min-h-screen bg-[#FAF8F4] grid place-items-center p-6 text-center">
      <Card className="max-w-md w-full p-8 shadow-sm">
        <div className="size-12 rounded-2xl bg-danger-tint text-danger grid place-items-center mx-auto mb-4 font-bold text-xl">
          !
        </div>
        <h2 className="text-xl font-bold text-ink">Something went wrong</h2>
        <p className="text-ink-2 text-sm mt-2 mb-6">
          {msg}
        </p>
        <div className="flex gap-3 justify-center">
          <Btn variant="secondary" onClick={() => window.location.reload()}>
            Try again
          </Btn>
          <Btn to="/app">
            Back to dashboard
          </Btn>
        </div>
      </Card>
    </div>
  )
}

import { RequireAuth } from '@/components/auth/RequireAuth'
export { RequireAuth }

export const router = createBrowserRouter([
  { path: '/', Component: Landing },
  { path: '/login', Component: Login },
  { path: '/signup', Component: Signup },
  {
    path: '/onboarding',
    element: (
      <RequireAuth>
        <Onboarding />
      </RequireAuth>
    ),
  },
  {
    path: '/app',
    ErrorBoundary: RouteErrorBoundary,
    element: (
      <RequireAuth>
        <Shell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="today" replace /> },
      { path: 'today', Component: Today },
      { path: 'specialists', Component: only('Client', SpecialistsList) },
      { path: 'specialists/:id', Component: only('Client', SpecialistProfile) },
      { path: 'specialists/:id/book', Component: only('Client', Booking) },
      { path: 'bookings', Component: only('Client', Bookings) },
      { path: 'bookings/checkout', Component: only('Client', Checkout) },
      { path: 'plan', Component: only('Client', Plan) },
      { path: 'progress', Component: only('Client', Progress) },
      { path: 'ai-plan', Component: only('Client', AiPlan) },
      { path: 'clients', Component: only('Specialist', Clients) },
      { path: 'clients/:id', Component: only('Specialist', ClientDetail) },
      { path: 'schedule', Component: only('Specialist', Schedule) },
      { path: 'overview', Component: only('Admin', Overview) },
      { path: 'users', Component: only('Admin', Users) },
      { path: 'approvals', Component: only('Admin', Approvals) },
      { path: 'finance/overview', Component: only('Finance', FinanceOverview) },
      { path: 'finance/transactions', Component: only('Finance', FinanceTransactions) },
      { path: 'finance/payouts', Component: only('Finance', FinancePayouts) },
      { path: 'finance/subscriptions', Component: only('Finance', FinanceSubscriptions) },
    ],
  },
  {
    path: '/session',
    element: (
      <RequireAuth>
        <Session />
      </RequireAuth>
    ),
  },
  { path: '*', Component: NotFound },
])
