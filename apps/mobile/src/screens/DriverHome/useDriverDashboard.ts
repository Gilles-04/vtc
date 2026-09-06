import { useCallback, useEffect, useRef, useState } from 'react'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { File } from 'expo-file-system'
import * as Location from 'expo-location'
import { supabase } from '../../lib/supabase'
import { registerForPushNotifications } from '../../lib/pushNotifications'
import { registerDeviceFingerprint } from '../../lib/deviceFingerprint'
import type {
  ActiveRide,
  ActiveSubscription,
  DriverDocType,
  DriverRecord,
  PassengerPublicInfo,
  RideHistoryRow,
  RideOffer,
  SubscriptionPlan,
} from '../../lib/types'

function documentStoragePath(userId: string, docType: DriverDocType, fileName: string): string {
  return `${userId}/${docType}-${Date.now()}-${fileName}`
}

// Toute la donnée + les mutations du tableau de bord chauffeur, séparées de
// l'affichage (DriverHomeScreen.tsx) — même approche que
// apps/web/src/pages/DriverHome/useDriverDashboard.ts (port direct).
export function useDriverDashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [driver, setDriver] = useState<DriverRecord | null | undefined>(undefined)
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null)
  const [offers, setOffers] = useState<RideOffer[]>([])
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null)
  const [passengerInfo, setPassengerInfo] = useState<PassengerPublicInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploadingType, setUploadingType] = useState<DriverDocType | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [reportRideId, setReportRideId] = useState<string | null>(null)
  const [driverName, setDriverName] = useState<string | null>(null)
  const [driverLanguage, setDriverLanguage] = useState('fr')
  const [rideToRate, setRideToRate] = useState<{ ride: RideHistoryRow; rateeName: string | null } | null>(null)

  const activeRideRef = useRef<ActiveRide | null>(null)
  useEffect(() => {
    activeRideRef.current = activeRide
  }, [activeRide])

  const loadDriver = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) {
      router.replace('/chauffeur')
      return
    }
    setUserId(uid)
    registerForPushNotifications(uid)
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

  // Profil (nom/langue) accessible même avant approbation (dossier en
  // attente/refusé), pas seulement une fois `approved`.
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

    if (!sub) {
      const { data: plansData } = await supabase
        .from('subscription_plans')
        .select('id, code, name, duration_hours, price_fcfa')
        .eq('category', driver.category)
        .eq('is_active', true)
        .order('sort_order')
      setPlans(plansData ?? [])
    }
  }, [driver])

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

  // Écran #11 (Fin de course) côté chauffeur — même logique que
  // apps/web/src/pages/DriverHome (voir TASK-047). Pas d'écran « Revenus »
  // côté mobile pour l'instant (#76 web uniquement) : requête dédiée,
  // volontairement minimale, juste pour détecter la notation.
  const loadRatingPrompt = useCallback(async () => {
    if (!driver || driver.status !== 'approved') return

    const { data } = await supabase
      .from('rides')
      .select('id, category, status, pickup_address, dropoff_address, final_fare_fcfa, estimated_fare_fcfa, requested_at, passenger_id')
      .eq('driver_id', driver.id)
      .eq('status', 'completed')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const latest = data as unknown as RideHistoryRow | null

    if (latest?.passenger_id) {
      const { data: existingRating } = await supabase
        .from('ratings')
        .select('id')
        .eq('ride_id', latest.id)
        .eq('rater_id', driver.id)
        .maybeSingle()
      if (!existingRating) {
        const { data: info } = await supabase.rpc('get_ride_passenger_public_info', { _ride_id: latest.id }).maybeSingle()
        setRideToRate({ ride: latest, rateeName: (info as PassengerPublicInfo | null)?.full_name ?? null })
        return
      }
    }
    setRideToRate(null)
  }, [driver])

  useEffect(() => {
    loadSubscriptionData()
    loadOffersAndRide()
    loadRatingPrompt()
  }, [loadSubscriptionData, loadOffersAndRide, loadRatingPrompt])

  useEffect(() => {
    if (!driver || driver.status !== 'approved') return

    const channel = supabase
      .channel(`driver-${driver.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_offers', filter: `driver_id=eq.${driver.id}` }, () => {
        loadOffersAndRide()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${driver.id}` }, () => {
        loadOffersAndRide()
        loadRatingPrompt()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [driver, loadOffersAndRide, loadRatingPrompt])

  // Position envoyée à update_driver_location (migration 2) pendant toute
  // la période où le chauffeur est disponible — condition nécessaire pour
  // dispatch_next_offer (docs/08-matching.md), qui exige `last_location_at`
  // récent (< 2 min). Continue pendant une course (is_available reste true
  // tant qu'aucune bascule manuelle) : _ride_id est alors renseigné pour
  // l'historique driver_locations. Foreground uniquement — jamais de
  // localisation en arrière-plan (voir README §Non fait ici).
  useEffect(() => {
    if (!driver || driver.status !== 'approved' || !driver.is_available) return
    let subscription: Location.LocationSubscription | null = null
    let cancelled = false

    async function start() {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (cancelled) return
      if (status !== 'granted') {
        setLocationError("Autorisation de localisation refusée — vous ne recevrez pas de demande de course tant qu'elle n'est pas accordée.")
        return
      }
      setLocationError(null)
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 20000, distanceInterval: 30 },
        (position) => {
          // .rpc(...) est un thenable paresseux (supabase-js) — la requête ne
          // part que lorsque .then()/await est invoqué. Fire-and-forget
          // volontaire ici (un ping GPS raté ne doit jamais bloquer l'UI),
          // mais il faut bien déclencher le .then() pour que ça parte.
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
      )
    }
    start()

    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [driver])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/chauffeur')
  }

  async function handleUpload(docType: DriverDocType) {
    if (!userId) return
    setError(null)
    const pick = await File.pickFileAsync({ mimeTypes: ['image/*', 'application/pdf'] })
    if (pick.canceled) return

    setUploadingType(docType)
    const file = pick.result
    const path = documentStoragePath(userId, docType, file.name)
    const buffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage.from('driver-documents').upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
    })
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

  function buyPlan(planCode: string) {
    Alert.alert('Confirmer l\'achat', 'Confirmer l\'achat de cet abonnement (paiement manuel, à confirmer par l\'équipe) ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Confirmer',
        onPress: async () => {
          setError(null)
          setBusy(true)
          const { error } = await supabase.rpc('purchase_subscription', { _plan_code: planCode, _provider: 'manual' })
          setBusy(false)
          if (error) {
            setError(error.message)
            return
          }
          Alert.alert('Demande envoyée', "Votre abonnement s'activera une fois le paiement confirmé par l'équipe.")
        },
      },
    ])
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

  function advanceRide() {
    if (!activeRide) return

    async function run(paid: boolean) {
      if (!activeRide) return
      setError(null)
      setBusy(true)
      let rpcError = null
      if (activeRide.status === 'accepted' || activeRide.status === 'driver_arriving') {
        ;({ error: rpcError } = await supabase.rpc('mark_driver_arrived', { _ride_id: activeRide.id }))
      } else if (activeRide.status === 'driver_arrived') {
        ;({ error: rpcError } = await supabase.rpc('start_ride', { _ride_id: activeRide.id }))
      } else if (activeRide.status === 'in_progress') {
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

    if (activeRide.status === 'in_progress' && activeRide.payment_method === 'cash') {
      Alert.alert('Paiement', 'Le passager a-t-il payé en espèces ?', [
        { text: 'Non', onPress: () => run(false) },
        { text: 'Oui', onPress: () => run(true) },
      ])
      return
    }
    run(true)
  }

  return {
    userId,
    driver,
    plans,
    activeSub,
    offers,
    activeRide,
    passengerInfo,
    error,
    busy,
    uploadingType,
    locationError,
    reportRideId,
    setReportRideId,
    driverName,
    setDriverName,
    driverLanguage,
    setDriverLanguage,
    rideToRate,
    setRideToRate,
    loadDriver,
    handleSignOut,
    handleUpload,
    toggleAvailability,
    buyPlan,
    respondToOffer,
    advanceRide,
  }
}
