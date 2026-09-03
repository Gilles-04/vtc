import { createRootRoute, createRoute, createRouter, Outlet, redirect } from '@tanstack/react-router'
import { supabase } from './lib/supabase'
import { Home } from './pages/Home'
import { ComingSoon } from './pages/ComingSoon'
import { PassengerLogin } from './pages/PassengerLogin'
import { PassengerHome } from './pages/PassengerHome'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
})

const passengerLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/passager',
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      throw redirect({ to: '/passager/accueil' })
    }
  },
  component: PassengerLogin,
})

const passengerHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/passager/accueil',
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      throw redirect({ to: '/passager' })
    }
  },
  component: PassengerHome,
})

const driverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chauffeur',
  component: () => <ComingSoon audience="chauffeur" />,
})

const routeTree = rootRoute.addChildren([homeRoute, passengerLoginRoute, passengerHomeRoute, driverRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
