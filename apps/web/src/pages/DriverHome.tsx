import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import { DriverOnboarding } from './DriverOnboarding'
import type {
  ActiveRide,
  ActiveSubscription,
  DriverDocType,
  DriverPublicInfo,
  DriverRecord,
  PassengerPublicInfo,
  RideHistoryRow,
  RideInvoice,
  RideOffer,
  SubscriptionPayment,
  SubscriptionPlan,
} from '../lib/types'
import { Badge, CategoryBadge, DocStatusBadge, DriverStatusBadge, RideStatusBadge } from '../components/Badge'
import { SosButton } from '../components/Sos'
import { ReportModal } from '../components/Report'
import { ProfileModal } from '../components/Profile'
import { NotificationsBell } from '../components/Notifications'
import { RatingModal } from '../components/RatingModal'
import { fcfa } from '../lib/format'

const REPORT_CATEGORIES = [
  { value: 'comportement_passager', label: 'Comportement du passager' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'paiement', label: 'Litige de paiement' },
  { value: 'autre', label: 'Autre' },
]

function documentStoragePath(userId: string, docType: DriverDocType, fileName: string): string {
  return `${userId}/${docType}-${Date.now()}-${fileName}`
}

const DOC_TYPES: { type: DriverDocType; label: string }[] = [
  { type: 'piece_identite', label: "Pièce d'identité" },
  { type: 'permis_conduire', label: 'Permis de conduire' },
  { type: 'carte_transport', label: 'Carte de transport' },
  { type: 'assurance', label: 'Assurance' },
  { type: 'carte_grise', label: 'Carte grise' },
  { type: 'photo_vehicule', label: 'Photo du véhicule' },
]

export function DriverHome() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [driver, setDriver] = useState<DriverRecord | null | undefined>(undefined)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null)
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPayment[]>([])
  const [driverName, setDriverName] = useState<string | null>(null)
  const [driverLanguage, setDriverLanguage] = useState('fr')
  const [profileOpen, setProfileOpen] = useState(false)
  const [offers, setOffers] = useState<RideOffer[]>([])
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null)
  const [passengerInfo, setPassengerInfo] = useState<PassengerPublicInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadingType, setUploadingType] = useState<DriverDocType | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [rideHistory, setRideHistory] = useState<RideHistoryRow[]>([])
  const [rideInvoicesByRide, setRideInvoicesByRide] = useState<Record<string, RideInvoice>>({})
  const [earnings, setEarnings] = useState({ today: 0, week: 0, month: 0 })
  const [reportRideId, setReportRideId] = useState<string | null>(null)
  const [rideToRate, setRideToRate] = useState<{ ride: RideHistoryRow; rateeName: string | null } | null>(null)

  const activeRideRef = useRef<ActiveRide | null>(null)
  useEffect(() => {
    activeRideRef.current = activeRide
  }, [activeRide])

  const loadDriver = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    setUserId(uid)

    const { data, error } = await supabase
      .from('drivers')
      .select(
        'id, category, status, city, is_available, rating_avg, rating_count, total_rides, acceptance_rate, cancellation_rate, vehicles(brand, model, color, plate_number, year), driver_documents(id, doc_type, file_path, status, rejection_reason, created_at)',
      )
      .eq('id', uid)
      .maybeSingle()

    if (error) {
      setError(error.message)
      return
    }
    setDriver((data as unknown as DriverRecord) ?? null)
  }, [])

  useEffect(() => {
    loadDriver()
  }, [loadDriver])

  const loadSubscriptionData = useCallback(async () => {
    if (!driver || driver.status !== 'approved') return

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('id, status, expires_at, subscription_plans(name)')
      .eq('driver_id', driver.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setActiveSub(sub as unknown as ActiveSubscription | null)

    // Chargé même avec un abonnement actif (pas seulement pour la liste
    // d'achat) : nécessaire pour retrouver le nom du plan sur les reçus PDF.
    const { data: plansData } = await supabase
      .from('subscription_plans')
      .select('id, code, name, duration_hours, price_fcfa')
      .eq('category', driver.category)
      .eq('is_active', true)
      .order('sort_order')
    setPlans(plansData ?? [])

    // Reçus PDF (docs/10-paiements.md §Historique et reçus) — uniquement les
    // paiements d'abonnement réussis, jamais un paiement de course (`invoices`
    // couvre ce flux séparément, rendu PDF non construit).
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('id, amount_fcfa, provider, provider_ref, status, metadata, created_at, confirmed_at')
      .eq('user_id', driver.id)
      .eq('purpose', 'driver_subscription')
      .eq('status', 'success')
      .order('confirmed_at', { ascending: false })
    setSubscriptionPayments((paymentsData as unknown as SubscriptionPayment[]) ?? [])
  }, [driver])

  // Profil (nom/langue) chargé indépendamment de loadSubscriptionData —
  // accessible même avant approbation (dossier en attente/refusé), pas
  // seulement une fois `approved`.
  useEffect(() => {
    if (!driver) return
    supabase
      .from('profiles')
      .select('full_name, language')
      .eq('id', driver.id)
      .maybeSingle()
      .then(({ data }) => {
        setDriverName(data?.full_name ?? null)
        setDriverLanguage(data?.language ?? 'fr')
      })
  }, [driver])

  // jsPDF embarque html2canvas/dompurify (plugin .html(), jamais utilisé
  // ici) et ajoute ~380 Ko gzip au bundle — chargé à la demande seulement,
  // pas dans le chunk principal (impact quasi nul, quasiment personne ne
  // télécharge un reçu à chaque visite).
  async function downloadReceipt(payment: SubscriptionPayment) {
    const plan = plans.find((p) => p.id === payment.metadata.plan_id || p.code === payment.metadata.plan_code)
    const { generateSubscriptionReceiptPdf } = await import('../lib/receipt')
    generateSubscriptionReceiptPdf(payment, plan, driverName)
  }

  const loadOffersAndRide = useCallback(async () => {
    if (!driver || driver.status !== 'approved') return

    const { data: rideData } = await supabase
      .from('rides')
      .select(
        'id, status, category, pickup_address, dropoff_address, estimated_fare_fcfa, estimated_distance_km, estimated_duration_min, payment_method',
      )
      .eq('driver_id', driver.id)
      .in('status', ['accepted', 'driver_arriving', 'driver_arrived', 'in_progress'])
      .maybeSingle()
    setActiveRide(rideData as unknown as ActiveRide | null)

    if (rideData) {
      const { data: info } = await supabase.rpc('get_ride_passenger_public_info', { _ride_id: rideData.id }).maybeSingle()
      setPassengerInfo(info as PassengerPublicInfo | null)
    } else {
      setPassengerInfo(null)
    }

    if (!rideData) {
      const { data: offersData } = await supabase
        .from('ride_offers')
        .select('id, ride_id, expires_at, rides(category, pickup_address, dropoff_address, estimated_fare_fcfa, estimated_distance_km)')
        .eq('driver_id', driver.id)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('sent_at', { ascending: false })
      setOffers((offersData as unknown as RideOffer[]) ?? [])
    } else {
      setOffers([])
    }
  }, [driver])

  // Écran #18 (docs/05-ecrans.md) : historique de courses + gains
  // jour/semaine/mois, net des frais de service (invoices.transport_amount_fcfa
  // — jamais mélangé aux revenus d'abonnement, voir docs/10-paiements.md).
  const loadRideHistoryAndEarnings = useCallback(async () => {
    if (!driver || driver.status !== 'approved') return

    const { data: historyData } = await supabase
      .from('rides')
      .select('id, category, status, pickup_address, dropoff_address, final_fare_fcfa, estimated_fare_fcfa, final_distance_km, requested_at, passenger_id')
      .eq('driver_id', driver.id)
      .in('status', ['completed', 'cancelled_by_passenger', 'cancelled_by_driver', 'cancelled_by_system'])
      .order('requested_at', { ascending: false })
      .limit(20)
    const rows = (historyData as unknown as RideHistoryRow[]) ?? []
    setRideHistory(rows)

    // Écran #11 (Fin de course) côté chauffeur — même logique que
    // PassengerHome.tsx (voir TASK-047).
    const latest = rows[0]
    if (latest?.status === 'completed' && latest.passenger_id) {
      const { data: existingRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('ride_id', latest.id)
        .eq('rater_id', driver.id)
        .maybeSingle()
      if (!existingRating) {
        const { data: info } = await supabase.rpc('get_ride_passenger_public_info', { _ride_id: latest.id }).maybeSingle()
        setRideToRate({ ride: latest, rateeName: (info as PassengerPublicInfo | null)?.full_name ?? null })
      } else {
        setRideToRate(null)
      }
    } else {
      setRideToRate(null)
    }

    if (rows.length > 0) {
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('id, invoice_number, ride_id, transport_amount_fcfa, platform_fee_fcfa, total_fcfa, payment_method, payment_reference, issued_at')
        .eq('driver_id', driver.id)
        .in(
          'ride_id',
          rows.map((r) => r.id),
        )
      const byRide: Record<string, RideInvoice> = {}
      for (const inv of (invoicesData as unknown as RideInvoice[]) ?? []) byRide[inv.ride_id] = inv
      setRideInvoicesByRide(byRide)
    } else {
      setRideInvoicesByRide({})
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const { data: earningsData } = await supabase
      .from('invoices')
      .select('transport_amount_fcfa, issued_at')
      .eq('driver_id', driver.id)
      .gte('issued_at', monthStart.toISOString())
    const earningRows = (earningsData as { transport_amount_fcfa: number; issued_at: string }[]) ?? []
    setEarnings({
      today: earningRows.filter((r) => new Date(r.issued_at) >= todayStart).reduce((sum, r) => sum + r.transport_amount_fcfa, 0),
      week: earningRows.filter((r) => new Date(r.issued_at) >= weekStart).reduce((sum, r) => sum + r.transport_amount_fcfa, 0),
      month: earningRows.reduce((sum, r) => sum + r.transport_amount_fcfa, 0),
    })
  }, [driver])

  // jsPDF chargé à la demande (voir §Reçus ci-dessous et TASK-037) — le
  // chauffeur connaît déjà ses propres infos (pas besoin d'appeler
  // get_ride_driver_public_info sur lui-même), seule l'identité du
  // passager passe par la fonction dédiée (RLS, docs/11-securite.md).
  async function downloadDriverInvoice(ride: RideHistoryRow) {
    const invoice = rideInvoicesByRide[ride.id]
    if (!invoice || !driver) return
    const { data: info } = await supabase.rpc('get_ride_passenger_public_info', { _ride_id: ride.id }).maybeSingle()
    const ownInfo: DriverPublicInfo = {
      full_name: driverName,
      rating_avg: driver.rating_avg,
      vehicle_brand: driver.vehicles?.brand ?? null,
      vehicle_model: driver.vehicles?.model ?? null,
      vehicle_color: driver.vehicles?.color ?? null,
      vehicle_plate: driver.vehicles?.plate_number ?? null,
    }
    const { generateRideInvoicePdf } = await import('../lib/invoice')
    generateRideInvoicePdf(invoice, ride, ownInfo, (info as PassengerPublicInfo | null)?.full_name ?? null)
  }

  useEffect(() => {
    loadSubscriptionData()
    loadOffersAndRide()
    loadRideHistoryAndEarnings()
  }, [loadSubscriptionData, loadOffersAndRide, loadRideHistoryAndEarnings])

  useEffect(() => {
    if (!driver || driver.status !== 'approved') return

    const channel = supabase
      .channel(`driver-${driver.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_offers', filter: `driver_id=eq.${driver.id}` }, () => {
        loadOffersAndRide()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${driver.id}` }, () => {
        loadOffersAndRide()
        loadRideHistoryAndEarnings()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [driver, loadOffersAndRide, loadRideHistoryAndEarnings])

  // Position envoyée à update_driver_location (migration 2) pendant toute
  // la période où le chauffeur est disponible — condition nécessaire pour
  // dispatch_next_offer (docs/08-matching.md), qui exige `last_location_at`
  // récent (< 2 min). Continue pendant une course (is_available reste true
  // tant qu'aucune bascule manuelle) : _ride_id est alors renseigné pour
  // l'historique driver_locations.
  useEffect(() => {
    if (!driver || driver.status !== 'approved' || !driver.is_available) return
    if (!navigator.geolocation) {
      setLocationError("Ce navigateur ne prend pas en charge la géolocalisation.")
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocationError(null)
        void supabase
          .rpc('update_driver_location', {
            _lat: position.coords.latitude,
            _lng: position.coords.longitude,
            _accuracy_meters: position.coords.accuracy ?? null,
            _ride_id: activeRideRef.current?.id ?? null,
          })
          .then(({ error }) => {
            if (error) console.warn('update_driver_location', error.message)
          })
      },
      () => {
        setLocationError("Autorisation de localisation refusée — vous ne recevrez pas de demande de course tant qu'elle n'est pas accordée.")
      },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 },
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [driver])

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate({ to: '/chauffeur' })
  }

  async function handleUpload(docType: DriverDocType, file: File) {
    if (!userId) return
    setError(null)
    setUploadingType(docType)
    const path = documentStoragePath(userId, docType, file.name)
    const { error: uploadError } = await supabase.storage.from('driver-documents').upload(path, file)
    if (uploadError) {
      setUploadingType(null)
      setError(uploadError.message)
      return
    }
    const { error: insertError } = await supabase.from('driver_documents').insert({ driver_id: userId, doc_type: docType, file_path: path })
    setUploadingType(null)
    if (insertError) {
      setError(insertError.message)
      return
    }
    loadDriver()
  }

  async function toggleAvailability() {
    if (!driver) return
    setError(null)
    setBusy(true)
    const { error } = await supabase.rpc('set_driver_availability', { _is_available: !driver.is_available })
    setBusy(false)
    if (error) {
      setError(error.message === 'no_active_subscription' ? "Aucun abonnement actif — achetez un abonnement pour passer disponible." : error.message)
      return
    }
    loadDriver()
  }

  async function buyPlan(planCode: string) {
    setError(null)
    if (!window.confirm('Confirmer l\'achat de cet abonnement (paiement manuel, à confirmer par l\'équipe) ?')) return
    setBusy(true)
    const { error } = await supabase.rpc('purchase_subscription', { _plan_code: planCode, _provider: 'manual' })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    window.alert("Demande envoyée — votre abonnement s'activera une fois le paiement confirmé par l'équipe.")
  }

  async function respondToOffer(offerId: string, accept: boolean) {
    setError(null)
    setBusy(true)
    const { error } = await supabase.rpc('respond_to_ride_offer', { _offer_id: offerId, _accept: accept })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    loadOffersAndRide()
  }

  async function advanceRide() {
    if (!activeRide) return
    setError(null)
    setBusy(true)
    let rpcError = null
    if (activeRide.status === 'accepted' || activeRide.status === 'driver_arriving') {
      ;({ error: rpcError } = await supabase.rpc('mark_driver_arrived', { _ride_id: activeRide.id }))
    } else if (activeRide.status === 'driver_arrived') {
      ;({ error: rpcError } = await supabase.rpc('start_ride', { _ride_id: activeRide.id }))
    } else if (activeRide.status === 'in_progress') {
      const paid = activeRide.payment_method === 'cash' ? window.confirm('Le passager a-t-il payé en espèces ?') : true
      ;({ error: rpcError } = await supabase.rpc('complete_ride', {
        _ride_id: activeRide.id,
        _final_distance_km: activeRide.estimated_distance_km ?? 0,
        _final_duration_min: activeRide.estimated_duration_min ?? 0,
        _payment_confirmed: paid,
      }))
    }
    setBusy(false)
    if (rpcError) {
      setError((rpcError as { message: string }).message)
      return
    }
    loadOffersAndRide()
  }

  if (driver === undefined) {
    return <p className="p-8 text-center text-sm text-ink-400">Chargement…</p>
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

      {driver === null && <DriverOnboarding onSubmitted={loadDriver} />}

      {driver && (
        <main className="mx-auto max-w-2xl px-4 pb-16">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <CategoryBadge category={driver.category} />
                <DriverStatusBadge status={driver.status} />
              </div>
              {driver.vehicles && (
                <p className="mt-2 text-sm text-ink-600">
                  {driver.vehicles.brand} {driver.vehicles.model} — {driver.vehicles.plate_number}
                </p>
              )}
            </div>
            {driver.total_rides > 0 && (
              <div className="text-right text-sm text-ink-600">
                <p>{driver.total_rides} course{driver.total_rides > 1 ? 's' : ''}</p>
                {driver.rating_count > 0 && <p>★ {driver.rating_avg.toFixed(1)}</p>}
              </div>
            )}
          </div>

          {(driver.acceptance_rate != null || driver.cancellation_rate != null) && (
            <div className="mb-6 grid grid-cols-2 gap-2">
              {driver.acceptance_rate != null && (
                <div className="rounded-xl border border-ink-100 bg-white p-3 text-center">
                  <p className="text-xs text-ink-400">Taux d'acceptation (30j)</p>
                  <p className="text-sm font-semibold text-ink-800">{driver.acceptance_rate.toFixed(0)}%</p>
                </div>
              )}
              {driver.cancellation_rate != null && (
                <div className="rounded-xl border border-ink-100 bg-white p-3 text-center">
                  <p className="text-xs text-ink-400">Taux d'annulation (30j)</p>
                  <p className="text-sm font-semibold text-ink-800">{driver.cancellation_rate.toFixed(0)}%</p>
                </div>
              )}
            </div>
          )}

          {driver.status !== 'approved' && driver.status !== 'suspended' && (
            <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
                Documents ({driver.driver_documents.length}/{DOC_TYPES.length} soumis)
              </h2>
              <div className="space-y-2">
                {DOC_TYPES.map(({ type, label }) => {
                  const doc = driver.driver_documents.find((d) => d.doc_type === type)
                  return (
                    <div key={type} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3">
                      <div>
                        <p className="text-sm font-medium text-ink-800">{label}</p>
                        {doc && (
                          <div className="mt-1 flex items-center gap-2">
                            <DocStatusBadge status={doc.status} />
                            {doc.rejection_reason && <span className="text-xs text-red-600">{doc.rejection_reason}</span>}
                          </div>
                        )}
                      </div>
                      <label className="cursor-pointer rounded-lg bg-navy-50 px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100">
                        {uploadingType === type ? 'Envoi…' : doc ? 'Remplacer' : 'Envoyer'}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          disabled={uploadingType !== null}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleUpload(type, file)
                            e.target.value = ''
                          }}
                        />
                      </label>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {driver.status === 'suspended' && (
            <section className="mb-6 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
              Votre compte chauffeur est suspendu. Contactez le support pour plus d'informations.
            </section>
          )}

          {driver.status === 'approved' && (
            <>
              <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Abonnement</h2>
                {activeSub ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink-800">{activeSub.subscription_plans?.name}</p>
                      <p className="text-xs text-ink-400">
                        Expire le {new Date(activeSub.expires_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge tone="green">Actif</Badge>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="mb-2 text-sm text-ink-600">Aucun abonnement actif — achetez-en un pour passer disponible.</p>
                    {plans.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
                        <div>
                          <p className="text-sm font-medium text-ink-800">{p.name}</p>
                          <p className="text-xs text-ink-400">{p.price_fcfa != null ? fcfa(p.price_fcfa) : '—'}</p>
                        </div>
                        <button
                          disabled={busy || p.price_fcfa == null}
                          onClick={() => buyPlan(p.code)}
                          className="rounded-lg bg-navy-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                        >
                          Acheter
                        </button>
                      </div>
                    ))}
                    {plans.length === 0 && <p className="text-sm text-ink-400">Aucun plan disponible pour votre catégorie actuellement.</p>}
                  </div>
                )}
              </section>

              {subscriptionPayments.length > 0 && (
                <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Reçus</h2>
                  <div className="space-y-2">
                    {subscriptionPayments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-3">
                        <div>
                          <p className="text-sm font-medium text-ink-800">
                            {plans.find((p) => p.id === payment.metadata.plan_id)?.name ?? payment.metadata.plan_code ?? 'Abonnement'}
                          </p>
                          <p className="text-xs text-ink-400">
                            {new Date(payment.confirmed_at ?? payment.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            {' — '}
                            {fcfa(payment.amount_fcfa)}
                          </p>
                        </div>
                        <button
                          onClick={() => downloadReceipt(payment)}
                          className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-50"
                        >
                          Télécharger
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Revenus</h2>
                <p className="mb-3 text-xs text-ink-400">Gains transport, net des frais de service — jamais mélangé à l'abonnement.</p>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-ink-100 p-3 text-center">
                    <p className="text-xs text-ink-400">Aujourd'hui</p>
                    <p className="text-sm font-semibold text-ink-800">{fcfa(earnings.today)}</p>
                  </div>
                  <div className="rounded-xl border border-ink-100 p-3 text-center">
                    <p className="text-xs text-ink-400">7 derniers jours</p>
                    <p className="text-sm font-semibold text-ink-800">{fcfa(earnings.week)}</p>
                  </div>
                  <div className="rounded-xl border border-ink-100 p-3 text-center">
                    <p className="text-xs text-ink-400">Ce mois-ci</p>
                    <p className="text-sm font-semibold text-ink-800">{fcfa(earnings.month)}</p>
                  </div>
                </div>

                {rideHistory.length > 0 ? (
                  <div className="space-y-2">
                    {rideHistory.map((r) => (
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
                          {rideInvoicesByRide[r.id] && (
                            <button
                              onClick={() => downloadDriverInvoice(r)}
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
                ) : (
                  <p className="text-sm text-ink-400">Aucune course dans votre historique pour le moment.</p>
                )}
              </section>

              {activeSub && !activeRide && (
                <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Disponibilité</h2>
                    <button
                      disabled={busy}
                      onClick={toggleAvailability}
                      className={`rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50 ${
                        driver.is_available ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-navy-600 text-white hover:bg-navy-700'
                      }`}
                    >
                      {driver.is_available ? 'Se mettre indisponible' : 'Se mettre disponible'}
                    </button>
                  </div>

                  {driver.is_available && locationError && (
                    <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{locationError}</div>
                  )}

                  {driver.is_available && !locationError && offers.length === 0 && (
                    <p className="text-sm text-ink-400">En attente d'une demande de course…</p>
                  )}

                  {offers.map((offer) => (
                    <div key={offer.id} className="mt-2 rounded-xl border border-gold-500 bg-gold-400/10 p-4">
                      <p className="text-sm text-ink-600">
                        {offer.rides.pickup_address} → {offer.rides.dropoff_address}
                      </p>
                      <p className="mt-1 text-sm font-medium text-ink-800">
                        {offer.rides.estimated_fare_fcfa != null ? fcfa(offer.rides.estimated_fare_fcfa) : '—'}
                        {offer.rides.estimated_distance_km != null && ` — ${offer.rides.estimated_distance_km} km`}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={busy}
                          onClick={() => respondToOffer(offer.id, true)}
                          className="rounded-lg bg-navy-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                        >
                          Accepter
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => respondToOffer(offer.id, false)}
                          className="rounded-lg bg-red-50 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          Refuser
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {activeRide && (
                <section className="mb-6 rounded-2xl border border-navy-500 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Course en cours</h2>
                    <RideStatusBadge status={activeRide.status} />
                  </div>
                  <p className="text-sm font-medium text-ink-800">{passengerInfo?.full_name || 'Passager'}</p>
                  <p className="mt-1 text-sm text-ink-600">
                    {activeRide.pickup_address} → {activeRide.dropoff_address}
                  </p>
                  <p className="mt-1 text-sm text-ink-600">
                    {activeRide.estimated_fare_fcfa != null ? fcfa(activeRide.estimated_fare_fcfa) : '—'} —{' '}
                    {activeRide.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}
                  </p>
                  <button
                    disabled={busy || activeRide.status === 'completed'}
                    onClick={advanceRide}
                    className="mt-4 w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                  >
                    {activeRide.status === 'accepted' || activeRide.status === 'driver_arriving'
                      ? 'Signaler mon arrivée'
                      : activeRide.status === 'driver_arrived'
                        ? 'Démarrer la course'
                        : 'Terminer la course'}
                  </button>
                  <button
                    onClick={() => setReportRideId(activeRide.id)}
                    className="mt-2 w-full rounded-lg border border-ink-100 py-2 text-xs font-medium text-ink-500 hover:bg-ink-50"
                  >
                    Signaler un problème
                  </button>
                </section>
              )}
            </>
          )}
        </main>
      )}

      {reportRideId && driver && (
        <ReportModal
          rideId={reportRideId}
          reporterId={driver.id}
          categories={REPORT_CATEGORIES}
          onClose={() => setReportRideId(null)}
        />
      )}

      {profileOpen && driver && (
        <ProfileModal
          userId={driver.id}
          initialFullName={driverName}
          initialLanguage={driverLanguage}
          onClose={() => setProfileOpen(false)}
          onSaved={(fullName, language) => {
            setDriverName(fullName || null)
            setDriverLanguage(language)
          }}
        />
      )}

      {rideToRate && driver && rideToRate.ride.passenger_id && (
        <RatingModal
          rideId={rideToRate.ride.id}
          raterId={driver.id}
          raterRole="driver"
          rateeId={rideToRate.ride.passenger_id}
          rateeName={rideToRate.rateeName}
          onClose={() => setRideToRate(null)}
        />
      )}
    </div>
  )
}
