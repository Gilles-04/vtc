import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from './lib/supabase'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { Drivers } from './pages/Drivers'
import { DriverDetail } from './pages/DriverDetail'
import { Rides } from './pages/Rides'
import { RideDetail } from './pages/RideDetail'
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
  loginRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
