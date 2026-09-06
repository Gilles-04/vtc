import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { SUPABASE_URL, fakeSession, mockCommon, json } from './mocks.ts'

const DRIVER_ID = '22222222-2222-2222-2222-222222222222'
const PASSENGER_ID = '33333333-3333-3333-3333-333333333333'

// Scan automatisé (règles WCAG 2.0/2.1 A+AA via axe-core) des deux écrans les
// plus complexes du produit — audit 7/12 (UX/UI, accessibilité). Un vrai
// audit visuel (navigation clavier, contraste perçu, responsive réel) reste
// à faire par une personne ou un outil de rendu visuel ; ceci détecte les
// violations structurelles automatisables (labels manquants, contraste
// calculable, structure de titres, rôles ARIA).
test.describe('Accessibilité (axe-core)', () => {
  test('DriverHome — dossier en attente', async ({ page, context }) => {
    await mockCommon(context, page, fakeSession(DRIVER_ID, 'kofi@vtctogo.test'))
    await page.route(`${SUPABASE_URL}/rest/v1/drivers**`, (route) =>
      route.fulfill(
        json([
          {
            id: DRIVER_ID,
            category: 'car',
            status: 'pending_review',
            city: 'Lomé',
            is_available: false,
            rating_avg: 0,
            rating_count: 0,
            total_rides: 0,
            acceptance_rate: null,
            cancellation_rate: null,
            vehicles: null,
            driver_documents: [],
          },
        ]),
      ),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, (route) => route.fulfill(json([{ full_name: 'Kofi Chauffeur', language: 'fr' }])))
    await page.route(`${SUPABASE_URL}/rest/v1/rides**`, (route) => route.fulfill(json([])))

    await page.goto('/chauffeur/accueil')
    await expect(page.getByText('VTC Togo')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('PassengerHome — formulaire de demande de course', async ({ page, context }) => {
    await mockCommon(context, page, fakeSession(PASSENGER_ID, 'ama@vtctogo.test'))
    await page.route(`${SUPABASE_URL}/rest/v1/rides**`, (route) => route.fulfill(json([])))
    await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, (route) => route.fulfill(json([{ full_name: 'Ama Cliente', language: 'fr' }])))
    await page.route(`${SUPABASE_URL}/rest/v1/zones**`, (route) => route.fulfill(json([])))
    await page.route(`${SUPABASE_URL}/rest/v1/invoices**`, (route) => route.fulfill(json([])))

    await page.goto('/passager/accueil')
    await expect(page.getByText('Demander une course')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })
})
