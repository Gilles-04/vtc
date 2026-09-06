import { test, expect } from '@playwright/test'
import { SUPABASE_URL, fakeSession, mockCommon, json } from './mocks.ts'

const PASSENGER_ID = '33333333-3333-3333-3333-333333333333'
const RIDE_ID = '44444444-4444-4444-4444-444444444444'

// Regression suite pour apps/web/src/pages/PassengerHome/ (découpé en
// TASK-052) : une seule course terminée non notée déclenche à la fois
// l'historique, la facture et la modale de notation — les trois sections
// doivent rester correctement reliées après tout futur changement.
test.describe('PassengerHome', () => {
  test('pas de course active : formulaire de demande + historique + notation en attente', async ({ page, context }) => {
    await mockCommon(context, page, fakeSession(PASSENGER_ID, 'ama@vtctogo.test'))
    await page.route(`${SUPABASE_URL}/rest/v1/rides**`, (route) => {
      const url = route.request().url()
      if (url.includes('final_fare_fcfa')) {
        return route.fulfill(
          json([
            { id: RIDE_ID, category: 'car', status: 'completed', pickup_address: 'Aéroport de Lomé', dropoff_address: 'Grand Marché', final_fare_fcfa: 2500, estimated_fare_fcfa: 2500, requested_at: '2026-09-04T18:00:00Z', driver_id: 'driver-1' },
          ]),
        )
      }
      return route.fulfill(json([]))
    })
    await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, (route) => route.fulfill(json([{ full_name: 'Ama Cliente', language: 'fr' }])))
    await page.route(`${SUPABASE_URL}/rest/v1/zones**`, (route) => route.fulfill(json([{ id: 'z1', name: 'Centre-ville', city: 'Lomé' }])))
    await page.route(`${SUPABASE_URL}/rest/v1/invoices**`, (route) =>
      route.fulfill(
        json([
          { id: 'inv1', invoice_number: 'INV-1', ride_id: RIDE_ID, transport_amount_fcfa: 2437, platform_fee_fcfa: 63, total_fcfa: 2500, payment_method: 'cash', payment_reference: null, issued_at: '2026-09-04T18:20:00Z' },
        ]),
      ),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_ride_driver_public_info`, (route) =>
      route.fulfill(json([{ full_name: 'Kofi Chauffeur', rating_avg: 4.8, vehicle_brand: 'Toyota', vehicle_model: 'Corolla', vehicle_color: 'Grise', vehicle_plate: 'TG-1234' }])),
    )

    await page.goto('/passager/accueil')

    await expect(page.getByText('Demander une course')).toBeVisible()
    await expect(page.getByRole('button', { name: '🚗 Voiture' })).toBeVisible()
    await expect(page.getByText('Grand Marché')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Facture' })).toBeVisible()
    await expect(page.getByText('Notez le chauffeur')).toBeVisible()
    await expect(page.getByText('Kofi Chauffeur')).toBeVisible()
  })

  test('course active : affiche le suivi au lieu du formulaire de demande', async ({ page, context }) => {
    await mockCommon(context, page, fakeSession(PASSENGER_ID, 'ama@vtctogo.test'))
    await page.route(`${SUPABASE_URL}/rest/v1/rides**`, (route) => {
      const url = route.request().url()
      if (url.includes('final_fare_fcfa')) return route.fulfill(json([]))
      return route.fulfill(
        json([
          { id: 'active-ride', status: 'driver_arriving', category: 'car', pickup_address: 'Bè', dropoff_address: 'Adidogomé', estimated_fare_fcfa: 1500, estimated_distance_km: 4.1, payment_method: 'cash', driver_id: 'driver-1' },
        ]),
      )
    })
    await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, (route) => route.fulfill(json([{ full_name: 'Ama Cliente', language: 'fr' }])))
    await page.route(`${SUPABASE_URL}/rest/v1/zones**`, (route) => route.fulfill(json([])))
    await page.route(`${SUPABASE_URL}/rest/v1/invoices**`, (route) => route.fulfill(json([])))
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_ride_driver_public_info`, (route) =>
      route.fulfill(json([{ full_name: 'Kofi Chauffeur', rating_avg: 4.8, vehicle_brand: 'Toyota', vehicle_model: 'Corolla', vehicle_color: 'Grise', vehicle_plate: 'TG-1234' }])),
    )

    await page.goto('/passager/accueil')

    await expect(page.getByText('Course en cours')).toBeVisible()
    await expect(page.getByText('Kofi Chauffeur')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Annuler la course' })).toBeVisible()
    await expect(page.getByText('Demander une course')).not.toBeVisible()
  })
})
