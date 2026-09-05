import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { DriverCategory, DriverPublicInfo, FareEstimate, PassengerActiveRide, PaymentMethodType, RideHistoryRow, RideInvoice, Zone } from '../lib/types'
import { Badge, CategoryBadge, RideStatusBadge } from '../components/Badge'
import { SosButton } from '../components/Sos'
import { ReportModal } from '../components/Report'
import { ProfileModal } from '../components/Profile'
import { LocationPicker, type LocationValue } from '../components/LocationPicker'
import { NotificationsBell } from '../components/Notifications'
import { RatingModal } from '../components/RatingModal'
import { fcfa } from '../lib/format'

const EMPTY_LOCATION: LocationValue = { address: '', lat: '', lng: '' }

const REPORT_CATEGORIES = [
  { value: 'comportement_chauffeur', label: 'Comportement du chauffeur' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'etat_vehicule', label: 'État du véhicule' },
  { value: 'itineraire', label: 'Itinéraire / détour' },
  { value: 'paiement', label: 'Litige de paiement' },
  { value: 'autre', label: 'Autre' },
]

const CANCELLABLE_STATUSES = ['requested', 'searching', 'accepted', 'driver_arriving', 'driver_arrived']
const ACTIVE_STATUSES = ['requested', 'searching', 'accepted', 'driver_arriving', 'driver_arrived', 'in_progress']
const TERMINAL_STATUSES = ['completed', 'cancelled_by_passenger', 'cancelled_by_driver', 'cancelled_by_system']

function pricingErrorMessage(code: string): string {
  switch (code) {
    case 'not_configured':
      return "La tarification en ligne n'est pas encore activée (intégration Google Maps en attente) — vous ne pouvez pas encore demander de course depuis l'application."
    case 'invalid_coordinates':
      return 'Coordonnées de départ ou de destination invalides.'
    case 'invalid_category':
      return 'Catégorie de véhicule invalide.'
    case 'directions_failed':
      return "Impossible de calculer l'itinéraire — vérifiez les coordonnées saisies."
    case 'pricing_failed':
    case 'no_pricing_rule_configured':
      return 'Aucun tarif configuré pour cette catégorie ou cette zone pour le moment.'
    default:
      return "Erreur lors de l'estimation du prix."
  }
}

export function PassengerHome() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [activeRide, setActiveRide] = useState<PassengerActiveRide | null | undefined>(undefined)
  const [driverInfo, setDriverInfo] = useState<DriverPublicInfo | null>(null)
  const [history, setHistory] = useState<RideHistoryRow[]>([])
  const [invoicesByRide, setInvoicesByRide] = useState<Record<string, RideInvoice>>({})
  const [passengerName, setPassengerName] = useState<string | null>(null)
  const [passengerLanguage, setPassengerLanguage] = useState('fr')
  const [profileOpen, setProfileOpen] = useState(false)
  const [zones, setZones] = useState<Zone[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reportRideId, setReportRideId] = useState<string | null>(null)
  const [rideToRate, setRideToRate] = useState<{ ride: RideHistoryRow; rateeName: string | null } | null>(null)

  const [category, setCategory] = useState<DriverCategory>('car')
  const [pickup, setPickup] = useState<LocationValue>(EMPTY_LOCATION)
  const [dropoff, setDropoff] = useState<LocationValue>(EMPTY_LOCATION)
  const [zoneId, setZoneId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('cash')
  const [estimate, setEstimate] = useState<FareEstimate | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)

  const loadActiveRide = useCallback(async (uid: string) => {
    const { data: rideData } = await supabase
      .from('rides')
      .select('id, status, category, pickup_address, dropoff_address, estimated_fare_fcfa, estimated_distance_km, payment_method, driver_id')
      .eq('passenger_id', uid)
      .in('status', ACTIVE_STATUSES)
      .order('requested_at', { ascending: false })
      .maybeSingle()
    setActiveRide((rideData as unknown as PassengerActiveRide) ?? null)

    if (rideData && (rideData as { driver_id: string | null }).driver_id) {
      const { data: info } = await supabase.rpc('get_ride_driver_public_info', { _ride_id: rideData.id }).maybeSingle()
      setDriverInfo(info as DriverPublicInfo | null)
    } else {
      setDriverInfo(null)
    }
  }, [])

  const loadHistory = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('rides')
      .select('id, category, status, pickup_address, dropoff_address, final_fare_fcfa, estimated_fare_fcfa, final_distance_km, requested_at, driver_id')
      .eq('passenger_id', uid)
      .in('status', TERMINAL_STATUSES)
      .order('requested_at', { ascending: false })
      .limit(20)
    const rows = (data as unknown as RideHistoryRow[]) ?? []
    setHistory(rows)

    // Écran #11 (Fin de course) : proposer la notation de la course la plus
    // récente si elle est terminée avec succès et pas encore notée par ce
    // passager — un avis par sens et par course (contrainte unique,
    // migration 1), jamais construit jusqu'ici (voir TASK-047).
    const latest = rows[0]
    if (latest?.status === 'completed' && latest.driver_id) {
      const { data: existingRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('ride_id', latest.id)
        .eq('rater_id', uid)
        .maybeSingle()
      if (!existingRating) {
        const { data: info } = await supabase.rpc('get_ride_driver_public_info', { _ride_id: latest.id }).maybeSingle()
        setRideToRate({ ride: latest, rateeName: (info as DriverPublicInfo | null)?.full_name ?? null })
      } else {
        setRideToRate(null)
      }
    } else {
      setRideToRate(null)
    }

    // Une facture n'existe que pour une course `completed` avec paiement
    // réussi (trigger `generate_invoice_on_ride_success`) — jamais pour
    // toute course terminée. Chargées en une fois pour tout l'historique
    // plutôt qu'à la demande : évite d'interroger `invoices` par course
    // juste pour savoir si le bouton Facture doit s'afficher.
    if (rows.length > 0) {
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('id, invoice_number, ride_id, transport_amount_fcfa, platform_fee_fcfa, total_fcfa, payment_method, payment_reference, issued_at')
        .eq('passenger_id', uid)
        .in(
          'ride_id',
          rows.map((r) => r.id),
        )
      const byRide: Record<string, RideInvoice> = {}
      for (const inv of (invoicesData as unknown as RideInvoice[]) ?? []) byRide[inv.ride_id] = inv
      setInvoicesByRide(byRide)
    } else {
      setInvoicesByRide({})
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      setUserId(uid)
      loadActiveRide(uid)
      loadHistory(uid)
      supabase
        .from('profiles')
        .select('full_name, language')
        .eq('id', uid)
        .maybeSingle()
        .then(({ data }) => {
          setPassengerName(data?.full_name ?? null)
          setPassengerLanguage(data?.language ?? 'fr')
        })
    })

    supabase
      .from('zones')
      .select('id, name, city')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setZones((data as Zone[]) ?? []))
  }, [loadActiveRide, loadHistory])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`passenger-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `passenger_id=eq.${userId}` }, () => {
        loadActiveRide(userId)
        loadHistory(userId)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, loadActiveRide, loadHistory])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate({ to: '/passager' })
  }

  async function estimateFare(e: FormEvent) {
    e.preventDefault()
    setEstimateError(null)
    setEstimate(null)
    if (!pickup.lat || !pickup.lng || !dropoff.lat || !dropoff.lng) {
      setEstimateError('Choisissez un point de départ et une destination sur la carte (ou via « Ma position »).')
      return
    }
    const pLat = Number(pickup.lat)
    const pLng = Number(pickup.lng)
    const dLat = Number(dropoff.lat)
    const dLng = Number(dropoff.lng)
    if ([pLat, pLng, dLat, dLng].some((v) => Number.isNaN(v))) {
      setEstimateError('Coordonnées invalides — réessayez de sélectionner les points sur la carte.')
      return
    }

    setEstimating(true)
    const { data, error: invokeError } = await supabase.functions.invoke('pricing-directions', {
      body: {
        pickup: { lat: pLat, lng: pLng },
        dropoff: { lat: dLat, lng: dLng },
        category,
        zone_id: zoneId || null,
      },
    })
    setEstimating(false)

    if (invokeError) {
      let reason = 'directions_failed'
      const ctx = (invokeError as { context?: Response }).context
      if (ctx) {
        try {
          const body = await ctx.clone().json()
          if (body?.error) reason = body.error
        } catch {
          // réponse non-JSON — on garde le message générique
        }
      }
      setEstimateError(pricingErrorMessage(reason))
      return
    }
    if (data?.error) {
      setEstimateError(pricingErrorMessage(data.error))
      return
    }
    setEstimate(data as FareEstimate)
  }

  async function confirmRequest() {
    if (!estimate || !userId) return
    setError(null)
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('create_ride_request', {
      _category: category,
      _pickup_lat: Number(pickup.lat),
      _pickup_lng: Number(pickup.lng),
      _pickup_address: pickup.address.trim() || `${pickup.lat}, ${pickup.lng}`,
      _dropoff_lat: Number(dropoff.lat),
      _dropoff_lng: Number(dropoff.lng),
      _dropoff_address: dropoff.address.trim() || `${dropoff.lat}, ${dropoff.lng}`,
      _distance_km: estimate.distance_km,
      _duration_min: estimate.duration_min,
      _payment_method: paymentMethod,
      _zone_id: zoneId || null,
    })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setEstimate(null)
    setPickup(EMPTY_LOCATION)
    setDropoff(EMPTY_LOCATION)
    loadActiveRide(userId)
  }

  async function cancelRide() {
    if (!activeRide) return
    if (!window.confirm('Annuler cette course ?')) return
    setError(null)
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('cancel_ride', { _ride_id: activeRide.id })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    if (userId) loadActiveRide(userId)
  }

  // jsPDF chargé à la demande seulement (voir apps/web/src/pages/DriverHome.tsx
  // pour le même choix côté reçu d'abonnement) — pas dans le chunk principal.
  async function downloadInvoice(ride: RideHistoryRow) {
    const invoice = invoicesByRide[ride.id]
    if (!invoice) return
    const { data: info } = await supabase.rpc('get_ride_driver_public_info', { _ride_id: ride.id }).maybeSingle()
    const { generateRideInvoicePdf } = await import('../lib/invoice')
    generateRideInvoicePdf(invoice, ride, (info as DriverPublicInfo | null) ?? null, passengerName)
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-600 text-lg">🚕</span>
          <span className="font-display text-lg font-bold text-ink-900">VTC Togo</span>
        </div>
        <div className="flex items-center gap-4">
          {userId && <NotificationsBell userId={userId} />}
          <SosButton rideId={activeRide?.id ?? null} />
          <button onClick={() => setProfileOpen(true)} className="text-sm font-medium text-ink-600 hover:underline">
            Profil
          </button>
          <button onClick={handleSignOut} className="text-sm font-medium text-ink-600 hover:underline">
            Se déconnecter
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-auto mb-4 max-w-2xl px-4">
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 pb-16">
        {activeRide === undefined && <p className="p-8 text-center text-sm text-ink-400">Chargement…</p>}

        {activeRide && (
          <section className="mb-6 rounded-2xl border border-navy-500 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Course en cours</h2>
              <RideStatusBadge status={activeRide.status} />
            </div>
            {driverInfo && (
              <p className="text-sm font-medium text-ink-800">
                {driverInfo.full_name || 'Chauffeur'}
                {driverInfo.rating_avg != null && ` — ★ ${driverInfo.rating_avg.toFixed(1)}`}
                {driverInfo.vehicle_brand && (
                  <span className="block text-xs text-ink-500">
                    {driverInfo.vehicle_brand} {driverInfo.vehicle_model} {driverInfo.vehicle_color} — {driverInfo.vehicle_plate}
                  </span>
                )}
              </p>
            )}
            {!driverInfo && <p className="text-sm text-ink-400">Recherche d'un chauffeur…</p>}
            <p className="mt-2 text-sm text-ink-600">
              {activeRide.pickup_address} → {activeRide.dropoff_address}
            </p>
            <p className="mt-1 text-sm text-ink-600">
              {activeRide.estimated_fare_fcfa != null ? fcfa(activeRide.estimated_fare_fcfa) : '—'} —{' '}
              {activeRide.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}
            </p>
            {CANCELLABLE_STATUSES.includes(activeRide.status) && (
              <button
                disabled={busy}
                onClick={cancelRide}
                className="mt-4 w-full rounded-lg bg-red-50 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Annuler la course
              </button>
            )}
            <button
              onClick={() => setReportRideId(activeRide.id)}
              className="mt-2 w-full rounded-lg border border-ink-100 py-2 text-xs font-medium text-ink-500 hover:bg-ink-50"
            >
              Signaler un problème
            </button>
          </section>
        )}

        {activeRide === null && (
          <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-400">Demander une course</h2>

            <form onSubmit={estimateFare}>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('car')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    category === 'car' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
                  }`}
                >
                  🚗 Voiture
                </button>
                <button
                  type="button"
                  onClick={() => setCategory('moto')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    category === 'moto' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
                  }`}
                >
                  🏍️ Moto-taxi
                </button>
              </div>

              <LocationPicker
                label="Adresse de départ"
                placeholder="Ex : Grand Marché, Lomé"
                value={pickup}
                onChange={setPickup}
              />

              <LocationPicker
                label="Destination"
                placeholder="Ex : Aéroport de Lomé"
                value={dropoff}
                onChange={setDropoff}
                initialCenter={pickup.lat && pickup.lng ? { lat: Number(pickup.lat), lng: Number(pickup.lng) } : undefined}
              />

              {zones.length > 0 && (
                <>
                  <label className="mb-1 block text-sm font-medium text-ink-800">Zone (optionnel)</label>
                  <select
                    value={zoneId}
                    onChange={(e) => setZoneId(e.target.value)}
                    className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink-800"
                  >
                    <option value="">— Aucune —</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} ({z.city})
                      </option>
                    ))}
                  </select>
                </>
              )}

              <label className="mb-1 block text-sm font-medium text-ink-800">Paiement</label>
              <div className="mb-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    paymentMethod === 'cash' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
                  }`}
                >
                  💵 Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('mobile_money')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    paymentMethod === 'mobile_money' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
                  }`}
                >
                  📱 Mobile Money
                </button>
              </div>

              {estimateError && (
                <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estimateError}</p>
              )}

              {estimate && (
                <div className="mb-4 rounded-lg bg-navy-50 px-3 py-3 text-sm text-navy-800">
                  <p className="font-semibold">{fcfa(estimate.fare_fcfa)}</p>
                  <p className="text-xs text-navy-600">
                    {estimate.distance_km} km — {estimate.duration_min} min{estimate.is_night ? ' — tarif de nuit' : ''}
                  </p>
                </div>
              )}

              {!estimate && (
                <button
                  type="submit"
                  disabled={estimating}
                  className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                >
                  {estimating ? 'Estimation…' : 'Estimer le prix'}
                </button>
              )}
              {estimate && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirmRequest}
                  className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                >
                  {busy ? 'Envoi…' : 'Confirmer la demande'}
                </button>
              )}
            </form>
          </section>
        )}

        {history.length > 0 && (
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Historique</h2>
            <div className="space-y-2">
              {history.map((r) => (
                <div key={r.id} className="rounded-xl border border-ink-100 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <CategoryBadge category={r.category} />
                    <RideStatusBadge status={r.status} />
                  </div>
                  <p className="text-sm text-ink-600">
                    {r.pickup_address} → {r.dropoff_address}
                  </p>
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-400">
                    <span>{new Date(r.requested_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                    <span>{(r.final_fare_fcfa ?? r.estimated_fare_fcfa) != null ? fcfa((r.final_fare_fcfa ?? r.estimated_fare_fcfa) as number) : '—'}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {invoicesByRide[r.id] && (
                      <button
                        onClick={() => downloadInvoice(r)}
                        className="rounded-lg border border-ink-200 px-3 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
                      >
                        Facture
                      </button>
                    )}
                    <button
                      onClick={() => setReportRideId(r.id)}
                      className="rounded-lg border border-ink-200 px-3 py-1 text-xs font-medium text-ink-500 hover:bg-ink-50"
                    >
                      Signaler
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeRide === null && history.length === 0 && (
          <p className="mt-2 text-center text-xs text-ink-400">
            <Badge tone="default">Aucune course pour le moment</Badge>
          </p>
        )}
      </main>

      {reportRideId && userId && (
        <ReportModal
          rideId={reportRideId}
          reporterId={userId}
          categories={REPORT_CATEGORIES}
          onClose={() => setReportRideId(null)}
        />
      )}

      {profileOpen && userId && (
        <ProfileModal
          userId={userId}
          initialFullName={passengerName}
          initialLanguage={passengerLanguage}
          onClose={() => setProfileOpen(false)}
          onSaved={(fullName, language) => {
            setPassengerName(fullName || null)
            setPassengerLanguage(language)
          }}
        />
      )}

      {rideToRate && userId && rideToRate.ride.driver_id && (
        <RatingModal
          rideId={rideToRate.ride.id}
          raterId={userId}
          raterRole="passenger"
          rateeId={rideToRate.ride.driver_id}
          rateeName={rideToRate.rateeName}
          onClose={() => setRideToRate(null)}
        />
      )}
    </div>
  )
}
