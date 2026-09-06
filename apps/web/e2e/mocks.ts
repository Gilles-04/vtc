import type { BrowserContext, Page } from '@playwright/test'

export const SUPABASE_URL = 'https://elrsjctwrvzglwogmmpq.supabase.co'
const PROJECT_REF = 'elrsjctwrvzglwogmmpq'

export function fakeSession(userId: string, email: string) {
  return {
    access_token: 'fake-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: { id: userId, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {} },
  }
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

/**
 * Injecte une session Supabase falsifiée (localStorage, avant tout script de
 * page) et mocke les endpoints REST/RPC communs aux deux tableaux de bord
 * (auth, empreinte d'appareil, notifications, support). Chaque test ajoute
 * ses propres routes pour les tables spécifiques à son écran.
 */
export async function mockCommon(context: BrowserContext, page: Page, session: ReturnType<typeof fakeSession>) {
  await context.addInitScript(
    ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
    { key: `sb-${PROJECT_REF}-auth-token`, session },
  )

  await page.route(`${SUPABASE_URL}/auth/v1/user`, (route) => route.fulfill(json(session.user)))
  await page.route(`${SUPABASE_URL}/rest/v1/device_fingerprints**`, (route) => route.fulfill(json([], 201)))
  await page.route(`${SUPABASE_URL}/rest/v1/notifications**`, (route) =>
    route.request().method() === 'PATCH' ? route.fulfill(json([])) : route.fulfill(json([])),
  )
  await page.route(`${SUPABASE_URL}/rest/v1/support_tickets**`, (route) =>
    route.request().method() === 'POST' ? route.fulfill(json([], 201)) : route.fulfill(json([])),
  )
  await page.route(`${SUPABASE_URL}/rest/v1/ratings**`, (route) => route.fulfill(json([])))
}

export { json }
