import { useCallback, useEffect, useState } from 'react'
import { router } from 'expo-router'
import { Alert } from 'react-native'
import { supabase } from '../../lib/supabase'
import { registerForPushNotifications } from '../../lib/pushNotifications'
import { registerDeviceFingerprint } from '../../lib/deviceFingerprint'
import type { DriverCategory, DriverPublicInfo, FareEstimate, PassengerActiveRide, PaymentMethodType, RideHistoryRow, Zone } from '../../lib/types'
import type { LocationValue } from '../../components/LocationPicker'

const EMPTY_LOCATION: LocationValue = { address: '', lat: '', lng: '' }

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

// Toute la donnée + les mutations du tableau de bord passager, séparées de
// l'affichage (PassengerHomeScreen.tsx) — même approche que
// apps/web/src/pages/PassengerHome/usePassengerDashboard.ts (port direct).
export function usePassengerDashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [activeRide, setActiveRide] = useState<PassengerActiveRide | null | undefined>(undefined)
  const [driverInfo, setDriverInfo] = useState<DriverPublicInfo | null>(null)
  const [history, setHistory] = useState<RideHistoryRow[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reportRideId, setReportRideId] = useState<string | null>(null)
  const [passengerName, setPassengerName] = useState<string | null>(null)
  const [passengerLanguage, setPassengerLanguage] = useState('fr')
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
      .select('id, category, status, pickup_address, dropoff_address, final_fare_fcfa, estimated_fare_fcfa, requested_at, driver_id')
      .eq('passenger_id', uid)
      .in('status', TERMINAL_STATUSES)
      .order('requested_at', { ascending: false })
      .limit(20)
    const rows = (data as unknown as RideHistoryRow[]) ?? []
    setHistory(rows)

    // Écran #11 (Fin de course) : proposer la notation de la course la plus
    // récente si elle est terminée avec succès et pas encore notée par ce
    // passager (voir apps/web/src/pages/PassengerHome, TASK-047).
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
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) {
        router.replace('/passager')
        return
      }
      setUserId(uid)
      loadActiveRide(uid)
      loadHistory(uid)
      registerForPushNotifications(uid)
      registerDeviceFingerprint(uid)
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
    router.replace('/passager')
  }

  async function estimateFare() {
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

  function cancelRide() {
    if (!activeRide) return
    Alert.alert('Annuler la course', 'Annuler cette course ?', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: async () => {
          setError(null)
          setBusy(true)
          const { error: rpcError } = await supabase.rpc('cancel_ride', { _ride_id: activeRide.id })
          setBusy(false)
          if (rpcError) {
            setError(rpcError.message)
            return
          }
          if (userId) loadActiveRide(userId)
        },
      },
    ])
  }

  return {
    userId,
    activeRide,
    driverInfo,
    history,
    zones,
    error,
    busy,
    reportRideId,
    setReportRideId,
    passengerName,
    setPassengerName,
    passengerLanguage,
    setPassengerLanguage,
    rideToRate,
    setRideToRate,
    category,
    setCategory,
    pickup,
    setPickup,
    dropoff,
    setDropoff,
    zoneId,
    setZoneId,
    paymentMethod,
    setPaymentMethod,
    estimate,
    estimateError,
    estimating,
    handleSignOut,
    estimateFare,
    confirmRequest,
    cancelRide,
  }
}
