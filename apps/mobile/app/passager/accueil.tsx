import { useCallback, useEffect, useState } from 'react'
import { router } from 'expo-router'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { supabase } from '../../src/lib/supabase'
import { Badge, CategoryBadge, RideStatusBadge } from '../../src/components/Badge'
import { SelectField } from '../../src/components/SelectField'
import { SosButton } from '../../src/components/Sos'
import { ReportModal } from '../../src/components/Report'
import { fcfa } from '../../src/lib/format'
import { colors } from '../../src/theme'
import type { DriverCategory, DriverPublicInfo, FareEstimate, PassengerActiveRide, PaymentMethodType, RideHistoryRow, Zone } from '../../src/lib/types'

const REPORT_CATEGORIES = [
  { value: 'comportement_chauffeur', label: 'Comportement du chauffeur' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'etat_vehicule', label: 'État du véhicule' },
  { value: 'itineraire', label: 'Itinéraire / détour' },
  { value: 'paiement', label: 'Litige de paiement' },
  { value: 'autre', label: 'Autre' },
]

// Port direct de apps/web/src/pages/PassengerHome.tsx — mêmes RPC/Edge
// Function, même logique. Le <select> HTML (zone) devient SelectField
// (Modal), les champs texte deviennent des TextInput.

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

export default function PassengerHome() {
  const [userId, setUserId] = useState<string | null>(null)
  const [activeRide, setActiveRide] = useState<PassengerActiveRide | null | undefined>(undefined)
  const [driverInfo, setDriverInfo] = useState<DriverPublicInfo | null>(null)
  const [history, setHistory] = useState<RideHistoryRow[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [reportRideId, setReportRideId] = useState<string | null>(null)

  const [category, setCategory] = useState<DriverCategory>('car')
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupLat, setPickupLat] = useState('6.1319')
  const [pickupLng, setPickupLng] = useState('1.2228')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [dropoffLat, setDropoffLat] = useState('')
  const [dropoffLng, setDropoffLng] = useState('')
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
      .select('id, category, status, pickup_address, dropoff_address, final_fare_fcfa, estimated_fare_fcfa, requested_at')
      .eq('passenger_id', uid)
      .in('status', TERMINAL_STATUSES)
      .order('requested_at', { ascending: false })
      .limit(20)
    setHistory((data as unknown as RideHistoryRow[]) ?? [])
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
    if (!pickupAddress.trim() || !dropoffAddress.trim()) {
      setEstimateError('Renseignez une adresse de départ et de destination.')
      return
    }
    const pLat = Number(pickupLat)
    const pLng = Number(pickupLng)
    const dLat = Number(dropoffLat)
    const dLng = Number(dropoffLng)
    if ([pLat, pLng, dLat, dLng].some((v) => Number.isNaN(v))) {
      setEstimateError('Coordonnées invalides — utilisez des nombres décimaux (ex : 6.1319).')
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
      _pickup_lat: Number(pickupLat),
      _pickup_lng: Number(pickupLng),
      _pickup_address: pickupAddress.trim(),
      _dropoff_lat: Number(dropoffLat),
      _dropoff_lng: Number(dropoffLng),
      _dropoff_address: dropoffAddress.trim(),
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
    setPickupAddress('')
    setDropoffAddress('')
    setDropoffLat('')
    setDropoffLng('')
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

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoEmoji}>🚕</Text>
          </View>
          <Text style={styles.brand}>VTC Togo</Text>
        </View>
        <View style={styles.headerRight}>
          <SosButton rideId={activeRide?.id ?? null} />
          <Pressable onPress={handleSignOut}>
            <Text style={styles.signOut}>Se déconnecter</Text>
          </Pressable>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
          {activeRide === undefined && <ActivityIndicator style={styles.loading} color={colors.navy600} />}

          {activeRide && (
            <View style={styles.activeRideCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Course en cours</Text>
                <RideStatusBadge status={activeRide.status} />
              </View>
              {driverInfo && (
                <View>
                  <Text style={styles.driverName}>
                    {driverInfo.full_name || 'Chauffeur'}
                    {driverInfo.rating_avg != null && ` — ★ ${driverInfo.rating_avg.toFixed(1)}`}
                  </Text>
                  {driverInfo.vehicle_brand && (
                    <Text style={styles.vehicleText}>
                      {driverInfo.vehicle_brand} {driverInfo.vehicle_model} {driverInfo.vehicle_color} — {driverInfo.vehicle_plate}
                    </Text>
                  )}
                </View>
              )}
              {!driverInfo && <Text style={styles.hintText}>Recherche d'un chauffeur…</Text>}
              <Text style={styles.rideAddress}>
                {activeRide.pickup_address} → {activeRide.dropoff_address}
              </Text>
              <Text style={styles.rideFare}>
                {activeRide.estimated_fare_fcfa != null ? fcfa(activeRide.estimated_fare_fcfa) : '—'} —{' '}
                {activeRide.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}
              </Text>
              {CANCELLABLE_STATUSES.includes(activeRide.status) && (
                <Pressable disabled={busy} onPress={cancelRide} style={[styles.dangerButton, { opacity: busy ? 0.5 : 1 }]}>
                  <Text style={styles.dangerButtonText}>Annuler la course</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setReportRideId(activeRide.id)} style={styles.reportButton}>
                <Text style={styles.reportButtonText}>Signaler un problème</Text>
              </Pressable>
            </View>
          )}

          {activeRide === null && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Demander une course</Text>
              <Text style={styles.formHint}>
                Saisie manuelle des coordonnées en attendant l'auto-complétion d'adresse (Google Places) — indiquez la
                latitude/longitude approximative des points de départ et d'arrivée.
              </Text>

              <View style={styles.toggleRow}>
                <Pressable style={[styles.toggle, category === 'car' && styles.toggleActive]} onPress={() => setCategory('car')}>
                  <Text style={category === 'car' ? styles.toggleTextActive : styles.toggleText}>🚗 Voiture</Text>
                </Pressable>
                <Pressable style={[styles.toggle, category === 'moto' && styles.toggleActive]} onPress={() => setCategory('moto')}>
                  <Text style={category === 'moto' ? styles.toggleTextActive : styles.toggleText}>🏍️ Moto-taxi</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>Adresse de départ</Text>
              <TextInput
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="Ex : Grand Marché, Lomé"
                placeholderTextColor={colors.ink400}
                style={styles.input}
              />
              <View style={styles.toggleRow}>
                <TextInput
                  value={pickupLat}
                  onChangeText={setPickupLat}
                  keyboardType="numbers-and-punctuation"
                  placeholder="Latitude"
                  placeholderTextColor={colors.ink400}
                  style={[styles.input, styles.half]}
                />
                <TextInput
                  value={pickupLng}
                  onChangeText={setPickupLng}
                  keyboardType="numbers-and-punctuation"
                  placeholder="Longitude"
                  placeholderTextColor={colors.ink400}
                  style={[styles.input, styles.half]}
                />
              </View>

              <Text style={styles.label}>Destination</Text>
              <TextInput
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                placeholder="Ex : Aéroport de Lomé"
                placeholderTextColor={colors.ink400}
                style={styles.input}
              />
              <View style={styles.toggleRow}>
                <TextInput
                  value={dropoffLat}
                  onChangeText={setDropoffLat}
                  keyboardType="numbers-and-punctuation"
                  placeholder="Latitude"
                  placeholderTextColor={colors.ink400}
                  style={[styles.input, styles.half]}
                />
                <TextInput
                  value={dropoffLng}
                  onChangeText={setDropoffLng}
                  keyboardType="numbers-and-punctuation"
                  placeholder="Longitude"
                  placeholderTextColor={colors.ink400}
                  style={[styles.input, styles.half]}
                />
              </View>

              {zones.length > 0 && (
                <>
                  <Text style={styles.label}>Zone (optionnel)</Text>
                  <View style={styles.selectWrap}>
                    <SelectField
                      value={zoneId}
                      onChange={setZoneId}
                      placeholder="— Aucune —"
                      options={[{ value: '', label: '— Aucune —' }, ...zones.map((z) => ({ value: z.id, label: `${z.name} (${z.city})` }))]}
                    />
                  </View>
                </>
              )}

              <Text style={styles.label}>Paiement</Text>
              <View style={styles.toggleRow}>
                <Pressable style={[styles.toggle, paymentMethod === 'cash' && styles.toggleActive]} onPress={() => setPaymentMethod('cash')}>
                  <Text style={paymentMethod === 'cash' ? styles.toggleTextActive : styles.toggleText}>💵 Cash</Text>
                </Pressable>
                <Pressable
                  style={[styles.toggle, paymentMethod === 'mobile_money' && styles.toggleActive]}
                  onPress={() => setPaymentMethod('mobile_money')}
                >
                  <Text style={paymentMethod === 'mobile_money' ? styles.toggleTextActive : styles.toggleText}>📱 Mobile Money</Text>
                </Pressable>
              </View>

              {estimateError && (
                <View style={styles.errorInline}>
                  <Text style={styles.errorText}>{estimateError}</Text>
                </View>
              )}

              {estimate && (
                <View style={styles.estimateBox}>
                  <Text style={styles.estimateFare}>{fcfa(estimate.fare_fcfa)}</Text>
                  <Text style={styles.estimateDetail}>
                    {estimate.distance_km} km — {estimate.duration_min} min{estimate.is_night ? ' — tarif de nuit' : ''}
                  </Text>
                </View>
              )}

              {!estimate && (
                <Pressable disabled={estimating} onPress={estimateFare} style={[styles.primaryButton, { opacity: estimating ? 0.5 : 1 }]}>
                  {estimating ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Estimer le prix</Text>}
                </Pressable>
              )}
              {estimate && (
                <Pressable disabled={busy} onPress={confirmRequest} style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}>
                  {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Confirmer la demande</Text>}
                </Pressable>
              )}
            </View>
          )}

          {history.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Historique</Text>
              {history.map((r) => (
                <View key={r.id} style={styles.historyRow}>
                  <View style={styles.rowBetween}>
                    <CategoryBadge category={r.category} />
                    <RideStatusBadge status={r.status} />
                  </View>
                  <Text style={styles.historyAddress}>
                    {r.pickup_address} → {r.dropoff_address}
                  </Text>
                  <View style={styles.rowBetween}>
                    <Text style={styles.historyDate}>
                      {new Date(r.requested_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </Text>
                    <Text style={styles.historyDate}>
                      {(r.final_fare_fcfa ?? r.estimated_fare_fcfa) != null ? fcfa((r.final_fare_fcfa ?? r.estimated_fare_fcfa) as number) : '—'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setReportRideId(r.id)} style={styles.historyReportButton}>
                    <Text style={styles.historyReportButtonText}>Signaler</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {activeRide === null && history.length === 0 && (
            <View style={styles.emptyWrap}>
              <Badge tone="default">Aucune course pour le moment</Badge>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {userId && (
        <ReportModal
          visible={reportRideId !== null}
          rideId={reportRideId}
          reporterId={userId}
          categories={REPORT_CATEGORIES}
          onClose={() => setReportRideId(null)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink50 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { height: 36, width: 36, borderRadius: 10, backgroundColor: colors.navy600, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 18 },
  brand: { fontSize: 18, fontWeight: '700', color: colors.ink900, marginLeft: 8 },
  signOut: { fontSize: 13, fontWeight: '600', color: colors.ink600 },
  errorBanner: { marginHorizontal: 20, marginBottom: 12, backgroundColor: colors.red50, borderRadius: 12, padding: 14 },
  errorText: { color: colors.red700, fontSize: 13 },
  main: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  loading: { marginTop: 40 },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 18 },
  activeRideCard: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.navy500, padding: 18 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  driverName: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  vehicleText: { fontSize: 12, color: colors.ink600, marginTop: 2 },
  hintText: { fontSize: 13, color: colors.ink400 },
  rideAddress: { marginTop: 8, fontSize: 13, color: colors.ink600 },
  rideFare: { marginTop: 4, fontSize: 13, color: colors.ink600 },
  dangerButton: { marginTop: 14, backgroundColor: colors.red50, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  dangerButtonText: { color: colors.red700, fontSize: 15, fontWeight: '600' },
  reportButton: { marginTop: 8, borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  reportButtonText: { fontSize: 12, fontWeight: '500', color: colors.ink400 },
  historyReportButton: { marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.ink100, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  historyReportButtonText: { fontSize: 11, fontWeight: '500', color: colors.ink400 },
  formHint: { fontSize: 11, color: colors.ink400, marginBottom: 16 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggle: { flex: 1, borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  toggleActive: { borderColor: colors.navy500, backgroundColor: colors.navy50 },
  toggleText: { fontSize: 13, fontWeight: '500', color: colors.ink600 },
  toggleTextActive: { fontSize: 13, fontWeight: '600', color: colors.navy700 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink800, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink900, marginBottom: 8 },
  half: { flex: 1 },
  selectWrap: { marginBottom: 12 },
  errorInline: { backgroundColor: colors.red50, borderRadius: 10, padding: 10, marginBottom: 12 },
  estimateBox: { backgroundColor: colors.navy50, borderRadius: 10, padding: 12, marginBottom: 12 },
  estimateFare: { fontSize: 15, fontWeight: '700', color: colors.navy700 },
  estimateDetail: { fontSize: 12, color: colors.navy600, marginTop: 2 },
  primaryButton: { backgroundColor: colors.navy600, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  historyRow: { borderWidth: 1, borderColor: colors.ink100, borderRadius: 12, padding: 12, marginBottom: 8, gap: 6 },
  historyAddress: { fontSize: 13, color: colors.ink600 },
  historyDate: { fontSize: 11, color: colors.ink400 },
  emptyWrap: { alignItems: 'center', marginTop: 8 },
})
