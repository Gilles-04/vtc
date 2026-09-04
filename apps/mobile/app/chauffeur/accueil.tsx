import { useCallback, useEffect, useRef, useState } from 'react'
import { router } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { File } from 'expo-file-system'
import * as Location from 'expo-location'
import { supabase } from '../../src/lib/supabase'
import { DriverOnboarding } from '../../src/components/DriverOnboarding'
import { Badge, CategoryBadge, DocStatusBadge, DriverStatusBadge, RideStatusBadge } from '../../src/components/Badge'
import { fcfa } from '../../src/lib/format'
import { colors } from '../../src/theme'
import type {
  ActiveRide,
  ActiveSubscription,
  DriverDocType,
  DriverRecord,
  PassengerPublicInfo,
  RideOffer,
  SubscriptionPlan,
} from '../../src/lib/types'

// Port direct de apps/web/src/pages/DriverHome.tsx — mêmes RPC, mêmes
// requêtes, même logique de statut. Seule différence réelle : l'upload de
// document (expo-file-system, pas d'<input type="file"> en React Native).

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

export default function DriverHome() {
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

    const { data, error } = await supabase
      .from('drivers')
      .select(
        'id, category, status, city, is_available, rating_avg, rating_count, total_rides, vehicles(brand, model, color, plate_number, year), driver_documents(id, doc_type, file_path, status, rejection_reason, created_at)',
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

  useEffect(() => {
    loadSubscriptionData()
    loadOffersAndRide()
  }, [loadSubscriptionData, loadOffersAndRide])

  useEffect(() => {
    if (!driver || driver.status !== 'approved') return

    const channel = supabase
      .channel(`driver-${driver.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_offers', filter: `driver_id=eq.${driver.id}` }, () => {
        loadOffersAndRide()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${driver.id}` }, () => {
        loadOffersAndRide()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [driver, loadOffersAndRide])

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

  if (driver === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy600} />
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoEmoji}>🚕</Text>
          </View>
          <Text style={styles.brand}>VTC Togo</Text>
        </View>
        <Pressable onPress={handleSignOut}>
          <Text style={styles.signOut}>Se déconnecter</Text>
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {driver === null && <DriverOnboarding onSubmitted={loadDriver} />}

      {driver && (
        <ScrollView contentContainerStyle={styles.main}>
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <CategoryBadge category={driver.category} />
              <DriverStatusBadge status={driver.status} />
            </View>
            {driver.vehicles && (
              <Text style={styles.vehicleText}>
                {driver.vehicles.brand} {driver.vehicles.model} — {driver.vehicles.plate_number}
              </Text>
            )}
            {driver.total_rides > 0 && (
              <View style={styles.statsRow}>
                <Text style={styles.statsText}>
                  {driver.total_rides} course{driver.total_rides > 1 ? 's' : ''}
                </Text>
                {driver.rating_count > 0 && <Text style={styles.statsText}>★ {driver.rating_avg.toFixed(1)}</Text>}
              </View>
            )}
          </View>

          {driver.status !== 'approved' && driver.status !== 'suspended' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>
                Documents ({driver.driver_documents.length}/{DOC_TYPES.length} soumis)
              </Text>
              {DOC_TYPES.map(({ type, label }) => {
                const doc = driver.driver_documents.find((d) => d.doc_type === type)
                return (
                  <View key={type} style={styles.docRow}>
                    <View style={styles.docInfo}>
                      <Text style={styles.docLabel}>{label}</Text>
                      {doc && (
                        <View style={styles.docStatusRow}>
                          <DocStatusBadge status={doc.status} />
                          {doc.rejection_reason && <Text style={styles.docRejection}>{doc.rejection_reason}</Text>}
                        </View>
                      )}
                    </View>
                    <Pressable
                      disabled={uploadingType !== null}
                      onPress={() => handleUpload(type)}
                      style={styles.uploadButton}
                    >
                      <Text style={styles.uploadButtonText}>{uploadingType === type ? 'Envoi…' : doc ? 'Remplacer' : 'Envoyer'}</Text>
                    </Pressable>
                  </View>
                )
              })}
            </View>
          )}

          {driver.status === 'suspended' && (
            <View style={styles.suspendedCard}>
              <Text style={styles.suspendedText}>Votre compte chauffeur est suspendu. Contactez le support pour plus d'informations.</Text>
            </View>
          )}

          {driver.status === 'approved' && (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Abonnement</Text>
                {activeSub ? (
                  <View style={styles.subActiveRow}>
                    <View>
                      <Text style={styles.subName}>{activeSub.subscription_plans?.name}</Text>
                      <Text style={styles.subExpiry}>
                        Expire le{' '}
                        {new Date(activeSub.expires_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Badge tone="green">Actif</Badge>
                  </View>
                ) : (
                  <>
                    <Text style={styles.subHint}>Aucun abonnement actif — achetez-en un pour passer disponible.</Text>
                    {plans.map((p) => (
                      <View key={p.id} style={styles.planRow}>
                        <View>
                          <Text style={styles.planName}>{p.name}</Text>
                          <Text style={styles.planPrice}>{p.price_fcfa != null ? fcfa(p.price_fcfa) : '—'}</Text>
                        </View>
                        <Pressable
                          disabled={busy || p.price_fcfa == null}
                          onPress={() => buyPlan(p.code)}
                          style={[styles.primaryButtonSmall, { opacity: busy || p.price_fcfa == null ? 0.5 : 1 }]}
                        >
                          <Text style={styles.primaryButtonSmallText}>Acheter</Text>
                        </Pressable>
                      </View>
                    ))}
                    {plans.length === 0 && <Text style={styles.subHint}>Aucun plan disponible pour votre catégorie actuellement.</Text>}
                  </>
                )}
              </View>

              {activeSub && !activeRide && (
                <View style={styles.card}>
                  <View style={styles.availabilityHeader}>
                    <Text style={styles.sectionTitle}>Disponibilité</Text>
                    <Pressable
                      disabled={busy}
                      onPress={toggleAvailability}
                      style={[
                        styles.availabilityButton,
                        driver.is_available ? styles.availabilityButtonOff : styles.availabilityButtonOn,
                        { opacity: busy ? 0.5 : 1 },
                      ]}
                    >
                      <Text style={driver.is_available ? styles.availabilityButtonOffText : styles.availabilityButtonOnText}>
                        {driver.is_available ? 'Se mettre indisponible' : 'Se mettre disponible'}
                      </Text>
                    </Pressable>
                  </View>

                  {driver.is_available && locationError && (
                    <View style={styles.locationErrorBox}>
                      <Text style={styles.locationErrorText}>{locationError}</Text>
                    </View>
                  )}

                  {driver.is_available && !locationError && offers.length === 0 && <Text style={styles.subHint}>En attente d'une demande de course…</Text>}

                  {offers.map((offer) => (
                    <View key={offer.id} style={styles.offerCard}>
                      <Text style={styles.offerAddress}>
                        {offer.rides.pickup_address} → {offer.rides.dropoff_address}
                      </Text>
                      <Text style={styles.offerFare}>
                        {offer.rides.estimated_fare_fcfa != null ? fcfa(offer.rides.estimated_fare_fcfa) : '—'}
                        {offer.rides.estimated_distance_km != null && ` — ${offer.rides.estimated_distance_km} km`}
                      </Text>
                      <View style={styles.offerActions}>
                        <Pressable
                          disabled={busy}
                          onPress={() => respondToOffer(offer.id, true)}
                          style={[styles.primaryButtonSmall, { opacity: busy ? 0.5 : 1 }]}
                        >
                          <Text style={styles.primaryButtonSmallText}>Accepter</Text>
                        </Pressable>
                        <Pressable
                          disabled={busy}
                          onPress={() => respondToOffer(offer.id, false)}
                          style={[styles.dangerButtonSmall, { opacity: busy ? 0.5 : 1 }]}
                        >
                          <Text style={styles.dangerButtonSmallText}>Refuser</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {activeRide && (
                <View style={styles.activeRideCard}>
                  <View style={styles.availabilityHeader}>
                    <Text style={styles.sectionTitle}>Course en cours</Text>
                    <RideStatusBadge status={activeRide.status} />
                  </View>
                  <Text style={styles.passengerName}>{passengerInfo?.full_name || 'Passager'}</Text>
                  <Text style={styles.rideAddress}>
                    {activeRide.pickup_address} → {activeRide.dropoff_address}
                  </Text>
                  <Text style={styles.rideFare}>
                    {activeRide.estimated_fare_fcfa != null ? fcfa(activeRide.estimated_fare_fcfa) : '—'} —{' '}
                    {activeRide.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}
                  </Text>
                  <Pressable disabled={busy} onPress={advanceRide} style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}>
                    <Text style={styles.primaryButtonText}>
                      {activeRide.status === 'accepted' || activeRide.status === 'driver_arriving'
                        ? 'Signaler mon arrivée'
                        : activeRide.status === 'driver_arrived'
                          ? 'Démarrer la course'
                          : 'Terminer la course'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink50 },
  center: { flex: 1, backgroundColor: colors.ink50, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { height: 36, width: 36, borderRadius: 10, backgroundColor: colors.navy600, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 18 },
  brand: { fontSize: 18, fontWeight: '700', color: colors.ink900, marginLeft: 8 },
  signOut: { fontSize: 13, fontWeight: '600', color: colors.ink600 },
  errorBanner: { marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.red50, borderRadius: 12, padding: 14 },
  errorText: { color: colors.red700, fontSize: 13 },
  main: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 18 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  vehicleText: { marginTop: 8, fontSize: 13, color: colors.ink600 },
  statsRow: { marginTop: 8, alignItems: 'flex-end' },
  statsText: { fontSize: 13, color: colors.ink600 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  docRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.ink100, borderRadius: 12, padding: 12, marginBottom: 8 },
  docInfo: { flex: 1, marginRight: 12 },
  docLabel: { fontSize: 14, fontWeight: '500', color: colors.ink800 },
  docStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  docRejection: { fontSize: 11, color: colors.red700 },
  uploadButton: { backgroundColor: colors.navy50, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  uploadButtonText: { fontSize: 13, fontWeight: '600', color: colors.navy700 },
  suspendedCard: { backgroundColor: colors.red50, borderRadius: 16, borderWidth: 1, borderColor: '#fecaca', padding: 18 },
  suspendedText: { color: colors.red700, fontSize: 13 },
  subActiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subName: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  subExpiry: { fontSize: 12, color: colors.ink400, marginTop: 2 },
  subHint: { fontSize: 13, color: colors.ink600, marginBottom: 8 },
  locationErrorBox: { backgroundColor: colors.red50, borderRadius: 10, padding: 12, marginBottom: 8 },
  locationErrorText: { color: colors.red700, fontSize: 13 },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.ink100, borderRadius: 12, padding: 12, marginBottom: 8 },
  planName: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  planPrice: { fontSize: 12, color: colors.ink400, marginTop: 2 },
  primaryButtonSmall: { backgroundColor: colors.navy600, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  primaryButtonSmallText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  dangerButtonSmall: { backgroundColor: colors.red50, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  dangerButtonSmallText: { color: colors.red700, fontSize: 13, fontWeight: '600' },
  availabilityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  availabilityButton: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  availabilityButtonOn: { backgroundColor: colors.navy600 },
  availabilityButtonOff: { backgroundColor: colors.red50 },
  availabilityButtonOnText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  availabilityButtonOffText: { color: colors.red700, fontSize: 13, fontWeight: '600' },
  offerCard: { marginTop: 8, borderWidth: 1, borderColor: colors.gold500, backgroundColor: '#fdf6e3', borderRadius: 12, padding: 14 },
  offerAddress: { fontSize: 13, color: colors.ink600 },
  offerFare: { marginTop: 4, fontSize: 14, fontWeight: '600', color: colors.ink800 },
  offerActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  activeRideCard: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.navy500, padding: 18 },
  passengerName: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  rideAddress: { marginTop: 6, fontSize: 13, color: colors.ink600 },
  rideFare: { marginTop: 4, fontSize: 13, color: colors.ink600 },
  primaryButton: { marginTop: 14, backgroundColor: colors.navy600, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
})
