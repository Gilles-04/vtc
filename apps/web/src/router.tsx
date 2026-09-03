import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import { Home } from './pages/Home'
import { ComingSoon } from './pages/ComingSoon'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
})

const passengerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/passager',
  component: () => <ComingSoon audience="passager" />,
})

const driverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/chauffeur',
  component: () => <ComingSoon audience="chauffeur" />,
})

const routeTree = rootRoute.addChildren([homeRoute, passengerRoute, driverRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
