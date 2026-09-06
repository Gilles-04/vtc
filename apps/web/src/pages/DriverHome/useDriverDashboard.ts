import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../../lib/supabase'
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
} from '../../lib/types'
import { registerDeviceFingerprint } from '../../lib/deviceFingerprint'

function documentStoragePath(userId: string, docType: DriverDocType, fileName: string): string {
  return `${userId}/${docType}-${Date.now()}-${fileName}`
}

// Toute la donnée + les mutations du tableau de bord chauffeur, séparées de
// l'affichage (index.tsx) — un seul endroit à lire pour comprendre ce que
// l'écran charge et modifie, indépendamment de sa mise en page.
export function useDriverDashboard() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState<string | null>(null)
  const [driver, setDriver] = useState<DriverRecord | null | undefined>(undefined)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null)
  const [subscriptionPayments, setSubscriptionPayments] = useState<SubscriptionPayment[]>([])
  const [driverName, setDriverName] = useState<string | null>(null)
  const [driverLanguage, setDriverLanguage] = useState('fr')
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
    registerDeviceFingerprint(uid)

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
    const { generateSubscriptionReceiptPdf } = await import('../../lib/receipt')
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
    const { generateRideInvoicePdf } = await import('../../lib/invoice')
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

  return {
    userId,
    driver,
    plans,
    activeSub,
    subscriptionPayments,
    driverName,
    driverLanguage,
    setDriverName,
    setDriverLanguage,
    offers,
    activeRide,
    passengerInfo,
    error,
    busy,
    uploadingType,
    locationError,
    rideHistory,
    rideInvoicesByRide,
    earnings,
    reportRideId,
    setReportRideId,
    rideToRate,
    setRideToRate,
    loadDriver,
    downloadReceipt,
    downloadDriverInvoice,
    handleSignOut,
    handleUpload,
    toggleAvailability,
    buyPlan,
    respondToOffer,
    advanceRide,
  }
}
