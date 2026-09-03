import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from './lib/supabase'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { Drivers } from './pages/Drivers'
import { DriverDetail } from './pages/DriverDetail'
import { Rides } from './pages/Rides'
import { RideDetail } from './pages/RideDetail'
import { Payments } from './pages/Payments'
import { Invoices } from './pages/Invoices'
import { Subscriptions } from './pages/Subscriptions'
import { SubscriptionPlans } from './pages/SubscriptionPlans'
import { Settlements } from './pages/Settlements'
import { Users } from './pages/Users'
import { UserDetail } from './pages/UserDetail'
import { Vehicles } from './pages/Vehicles'
import { Zones } from './pages/Zones'
import { Pricing } from './pages/Pricing'
import { Complaints } from './pages/Complaints'
import { Fraud } from './pages/Fraud'
import { GlobalStats } from './pages/GlobalStats'
import { Shell } from './components/Shell'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

async function requireSession() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) {
    throw redirect({ to: '/login' })
  }
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Overview />
    </Shell>
  ),
})

const driversRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chauffeurs',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Drivers />
    </Shell>
  ),
})

const driverDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chauffeurs/$driverId',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <DriverDetail />
    </Shell>
  ),
})

const ridesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/courses',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Rides />
    </Shell>
  ),
})

const rideDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/courses/$rideId',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <RideDetail />
    </Shell>
  ),
})

const paymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/paiements',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Payments />
    </Shell>
  ),
})

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/facturation',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Invoices />
    </Shell>
  ),
})

const subscriptionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/abonnements',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Subscriptions />
    </Shell>
  ),
})

const subscriptionPlansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/abonnements/plans',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <SubscriptionPlans />
    </Shell>
  ),
})

const settlementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reglements',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Settlements />
    </Shell>
  ),
})

const usersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/utilisateurs',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Users />
    </Shell>
  ),
})

const userDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/utilisateurs/$userId',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <UserDetail />
    </Shell>
  ),
})

const vehiclesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vehicules',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Vehicles />
    </Shell>
  ),
})

const zonesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/zones',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Zones />
    </Shell>
  ),
})

const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/tarification',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Pricing />
    </Shell>
  ),
})

const complaintsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reclamations',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Complaints />
    </Shell>
  ),
})

const fraudRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/fraude',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <Fraud />
    </Shell>
  ),
})

const globalStatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/statistiques',
  beforeLoad: requireSession,
  component: () => (
    <Shell>
      <GlobalStats />
    </Shell>
  ),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      throw redirect({ to: '/' })
    }
  },
  component: Login,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  driversRoute,
  driverDetailRoute,
  ridesRoute,
  rideDetailRoute,
  paymentsRoute,
  invoicesRoute,
  subscriptionsRoute,
  subscriptionPlansRoute,
  settlementsRoute,
  usersRoute,
  userDetailRoute,
  vehiclesRoute,
  zonesRoute,
  pricingRoute,
  complaintsRoute,
  fraudRoute,
  globalStatsRoute,
  loginRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
