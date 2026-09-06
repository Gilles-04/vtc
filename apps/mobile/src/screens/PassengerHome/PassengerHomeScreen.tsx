import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Badge } from '../../components/Badge'
import { SosButton } from '../../components/Sos'
import { ReportModal } from '../../components/Report'
import { ProfileModal } from '../../components/Profile'
import { NotificationsButton } from '../../components/Notifications'
import { SupportButton } from '../../components/Support'
import { RatingModal } from '../../components/RatingModal'
import { colors } from '../../theme'
import { usePassengerDashboard } from './usePassengerDashboard'
import { ActiveRideSection } from './ActiveRideSection'
import { RequestRideSection } from './RequestRideSection'
import { HistorySection } from './HistorySection'

const REPORT_CATEGORIES = [
  { value: 'comportement_chauffeur', label: 'Comportement du chauffeur' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'etat_vehicule', label: 'État du véhicule' },
  { value: 'itineraire', label: 'Itinéraire / détour' },
  { value: 'paiement', label: 'Litige de paiement' },
  { value: 'autre', label: 'Autre' },
]

// Port direct de apps/web/src/pages/PassengerHome/ — mêmes RPC/Edge
// Function, même logique. Le <select> HTML (zone) devient SelectField
// (Modal) ; départ/destination via LocationPicker (WebView, TASK-044).
export default function PassengerHomeScreen() {
  const [profileOpen, setProfileOpen] = useState(false)
  const d = usePassengerDashboard()

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
          {d.userId && <NotificationsButton userId={d.userId} />}
          <SosButton rideId={d.activeRide?.id ?? null} />
          {d.userId && <SupportButton userId={d.userId} />}
          <Pressable onPress={() => setProfileOpen(true)}>
            <Text style={styles.signOut}>Profil</Text>
          </Pressable>
          <Pressable onPress={d.handleSignOut}>
            <Text style={styles.signOut}>Se déconnecter</Text>
          </Pressable>
        </View>
      </View>

      {d.error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{d.error}</Text>
        </View>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
          {d.activeRide === undefined && <ActivityIndicator style={styles.loading} color={colors.navy600} />}

          {d.activeRide && (
            <ActiveRideSection activeRide={d.activeRide} driverInfo={d.driverInfo} busy={d.busy} onCancel={d.cancelRide} onReport={d.setReportRideId} />
          )}

          {d.activeRide === null && (
            <RequestRideSection
              category={d.category}
              onCategoryChange={d.setCategory}
              pickup={d.pickup}
              onPickupChange={d.setPickup}
              dropoff={d.dropoff}
              onDropoffChange={d.setDropoff}
              zones={d.zones}
              zoneId={d.zoneId}
              onZoneIdChange={d.setZoneId}
              paymentMethod={d.paymentMethod}
              onPaymentMethodChange={d.setPaymentMethod}
              estimate={d.estimate}
              estimateError={d.estimateError}
              estimating={d.estimating}
              busy={d.busy}
              onEstimate={d.estimateFare}
              onConfirm={d.confirmRequest}
            />
          )}

          {d.history.length > 0 && <HistorySection history={d.history} onReport={d.setReportRideId} />}

          {d.activeRide === null && d.history.length === 0 && (
            <View style={styles.emptyWrap}>
              <Badge tone="default">Aucune course pour le moment</Badge>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {d.userId && (
        <ReportModal
          visible={d.reportRideId !== null}
          rideId={d.reportRideId}
          reporterId={d.userId}
          categories={REPORT_CATEGORIES}
          onClose={() => d.setReportRideId(null)}
        />
      )}

      {d.userId && (
        <ProfileModal
          visible={profileOpen}
          userId={d.userId}
          initialFullName={d.passengerName}
          initialLanguage={d.passengerLanguage}
          onClose={() => setProfileOpen(false)}
          onSaved={(fullName, language) => {
            d.setPassengerName(fullName || null)
            d.setPassengerLanguage(language)
          }}
        />
      )}

      {d.userId && d.rideToRate && d.rideToRate.ride.driver_id && (
        <RatingModal
          visible
          rideId={d.rideToRate.ride.id}
          raterId={d.userId}
          raterRole="passenger"
          rateeId={d.rideToRate.ride.driver_id}
          rateeName={d.rideToRate.rateeName}
          onClose={() => d.setRideToRate(null)}
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
  emptyWrap: { alignItems: 'center', marginTop: 8 },
})
