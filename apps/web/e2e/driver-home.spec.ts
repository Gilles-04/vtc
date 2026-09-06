import { test, expect } from '@playwright/test'
import { SUPABASE_URL, fakeSession, mockCommon, json } from './mocks.ts'

const DRIVER_ID = '22222222-2222-2222-2222-222222222222'

function driverRow(status: string, isAvailable: boolean) {
  return {
    id: DRIVER_ID,
    category: 'car',
    status,
    city: 'Lomé',
    is_available: isAvailable,
    rating_avg: 4.7,
    rating_count: 12,
    total_rides: 12,
    acceptance_rate: 92,
    cancellation_rate: 3,
    vehicles: { brand: 'Toyota', model: 'Corolla', color: 'Grise', plate_number: 'TG-1234', year: 2018 },
    driver_documents:
      status === 'pending_review'
        ? [{ id: 'doc1', doc_type: 'piece_identite', file_path: 'x', status: 'pending', rejection_reason: null, created_at: '2026-09-01T00:00:00Z' }]
        : [],
  }
}

// Regression suite pour apps/web/src/pages/DriverHome/ (découpé en TASK-052) :
// vérifie que le hook + les 5 sections d'affichage restent correctement
// reliés après tout futur changement, sur les 3 états qui déterminent le
// rendu (dossier en attente, approuvé avec abonnement, course en cours).
test.describe('DriverHome', () => {
  test('dossier en attente : affiche la section Documents', async ({ page, context }) => {
    await mockCommon(context, page, fakeSession(DRIVER_ID, 'kofi@vtctogo.test'))
    await page.route(`${SUPABASE_URL}/rest/v1/drivers**`, (route) => route.fulfill(json([driverRow('pending_review', false)])))
    await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, (route) => route.fulfill(json([{ full_name: 'Kofi Chauffeur', language: 'fr' }])))
    await page.route(`${SUPABASE_URL}/rest/v1/rides**`, (route) => route.fulfill(json([])))

    await page.goto('/chauffeur/accueil')

    await expect(page.getByText('VTC Togo')).toBeVisible()
    await expect(page.getByText(/Documents \(\d\/6 soumis\)/)).toBeVisible()
    await expect(page.getByText("Pièce d'identité")).toBeVisible()
  })

  test('approuvé : abonnement actif, historique avec facture, offre en attente', async ({ page, context }) => {
    await mockCommon(context, page, fakeSession(DRIVER_ID, 'kofi@vtctogo.test'))
    await page.route(`${SUPABASE_URL}/rest/v1/drivers**`, (route) => route.fulfill(json([driverRow('approved', true)])))
    await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, (route) => route.fulfill(json([{ full_name: 'Kofi Chauffeur', language: 'fr' }])))
    await page.route(`${SUPABASE_URL}/rest/v1/subscriptions**`, (route) =>
      route.fulfill(json([{ id: 'sub1', status: 'active', expires_at: '2099-01-01T12:00:00Z', subscription_plans: { name: 'Pass Jour' } }])),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/subscription_plans**`, (route) => route.fulfill(json([])))
    await page.route(`${SUPABASE_URL}/rest/v1/payments**`, (route) => route.fulfill(json([])))
    await page.route(`${SUPABASE_URL}/rest/v1/invoices**`, (route) =>
      route.fulfill(
        json([
          { id: 'inv1', invoice_number: 'INV-1', ride_id: 'ride-1', transport_amount_fcfa: 2437, platform_fee_fcfa: 63, total_fcfa: 2500, payment_method: 'cash', payment_reference: null, issued_at: '2026-09-04T18:20:00Z' },
        ]),
      ),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/ride_offers**`, (route) =>
      route.fulfill(
        json([
          { id: 'offer1', ride_id: 'ride-offer-1', expires_at: '2099-01-01T00:00:00Z', rides: { category: 'car', pickup_address: 'Bè', dropoff_address: 'Adidogomé', estimated_fare_fcfa: 1500, estimated_distance_km: 4.1 } },
        ]),
      ),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/rides**`, (route) => {
      const url = route.request().url()
      if (url.includes('final_fare_fcfa')) {
        return route.fulfill(
          json([
            { id: 'ride-1', category: 'car', status: 'completed', pickup_address: 'Aéroport de Lomé', dropoff_address: 'Grand Marché', final_fare_fcfa: 2500, estimated_fare_fcfa: 2500, requested_at: '2026-09-04T18:00:00Z', passenger_id: 'passenger-1' },
          ]),
        )
      }
      return route.fulfill(json([]))
    })
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_ride_passenger_public_info`, (route) => route.fulfill(json([{ full_name: 'Ama Cliente' }])))

    await page.goto('/chauffeur/accueil')

    await expect(page.getByText('Pass Jour')).toBeVisible()
    await expect(page.getByText('Grand Marché')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Facture' })).toBeVisible()
    await expect(page.getByText('Adidogomé')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Accepter' })).toBeVisible()
  })

  test('course en cours : remplace la section Disponibilité par Course en cours', async ({ page, context }) => {
    await mockCommon(context, page, fakeSession(DRIVER_ID, 'kofi@vtctogo.test'))
    await page.route(`${SUPABASE_URL}/rest/v1/drivers**`, (route) => route.fulfill(json([driverRow('approved', true)])))
    await page.route(`${SUPABASE_URL}/rest/v1/profiles**`, (route) => route.fulfill(json([{ full_name: 'Kofi Chauffeur', language: 'fr' }])))
    await page.route(`${SUPABASE_URL}/rest/v1/subscriptions**`, (route) =>
      route.fulfill(json([{ id: 'sub1', status: 'active', expires_at: '2099-01-01T12:00:00Z', subscription_plans: { name: 'Pass Jour' } }])),
    )
    await page.route(`${SUPABASE_URL}/rest/v1/subscription_plans**`, (route) => route.fulfill(json([])))
    await page.route(`${SUPABASE_URL}/rest/v1/payments**`, (route) => route.fulfill(json([])))
    await page.route(`${SUPABASE_URL}/rest/v1/invoices**`, (route) => route.fulfill(json([])))
    await page.route(`${SUPABASE_URL}/rest/v1/rides**`, (route) => {
      const url = route.request().url()
      if (url.includes('final_fare_fcfa')) return route.fulfill(json([]))
      return route.fulfill(
        json([
          { id: 'active-ride-1', status: 'in_progress', category: 'car', pickup_address: 'Bè', dropoff_address: 'Adidogomé', estimated_fare_fcfa: 1500, estimated_distance_km: 4.1, estimated_duration_min: 12, payment_method: 'cash' },
        ]),
      )
    })
    await page.route(`${SUPABASE_URL}/rest/v1/rpc/get_ride_passenger_public_info`, (route) => route.fulfill(json([{ full_name: 'Ama Cliente' }])))

    await page.goto('/chauffeur/accueil')

    await expect(page.getByText('Course en cours')).toBeVisible()
    await expect(page.getByText('Ama Cliente')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Terminer la course' })).toBeVisible()
    await expect(page.getByText('Se mettre indisponible')).not.toBeVisible()
  })
})
