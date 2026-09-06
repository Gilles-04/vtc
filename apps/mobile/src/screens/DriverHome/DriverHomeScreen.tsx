import { useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { DriverOnboarding } from '../../components/DriverOnboarding'
import { CategoryBadge, DriverStatusBadge } from '../../components/Badge'
import { SosButton } from '../../components/Sos'
import { ReportModal } from '../../components/Report'
import { ProfileModal } from '../../components/Profile'
import { NotificationsButton } from '../../components/Notifications'
import { SupportButton } from '../../components/Support'
import { RatingModal } from '../../components/RatingModal'
import { colors } from '../../theme'
import { useDriverDashboard } from './useDriverDashboard'
import { DocumentsSection } from './DocumentsSection'
import { SubscriptionSection } from './SubscriptionSection'
import { AvailabilitySection } from './AvailabilitySection'
import { ActiveRideSection } from './ActiveRideSection'

const REPORT_CATEGORIES = [
  { value: 'comportement_passager', label: 'Comportement du passager' },
  { value: 'securite', label: 'Sécurité' },
  { value: 'paiement', label: 'Litige de paiement' },
  { value: 'autre', label: 'Autre' },
]

// Port direct de apps/web/src/pages/DriverHome/ — mêmes RPC, mêmes
// requêtes, même logique de statut. Seule différence réelle : l'upload de
// document (expo-file-system, pas d'<input type="file"> en React Native).
export default function DriverHomeScreen() {
  const [profileOpen, setProfileOpen] = useState(false)
  const d = useDriverDashboard()

  if (d.driver === undefined) {
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

      {d.driver === null && <DriverOnboarding onSubmitted={d.loadDriver} />}

      {d.driver && (
        <ScrollView contentContainerStyle={styles.main}>
          <View style={styles.card}>
            <View style={styles.badgeRow}>
              <CategoryBadge category={d.driver.category} />
              <DriverStatusBadge status={d.driver.status} />
            </View>
            {d.driver.vehicles && (
              <Text style={styles.vehicleText}>
                {d.driver.vehicles.brand} {d.driver.vehicles.model} — {d.driver.vehicles.plate_number}
              </Text>
            )}
            {d.driver.total_rides > 0 && (
              <View style={styles.statsRow}>
                <Text style={styles.statsText}>
                  {d.driver.total_rides} course{d.driver.total_rides > 1 ? 's' : ''}
                </Text>
                {d.driver.rating_count > 0 && <Text style={styles.statsText}>★ {d.driver.rating_avg.toFixed(1)}</Text>}
              </View>
            )}
          </View>

          {(d.driver.acceptance_rate != null || d.driver.cancellation_rate != null) && (
            <View style={styles.reliabilityRow}>
              {d.driver.acceptance_rate != null && (
                <View style={styles.reliabilityCard}>
                  <Text style={styles.reliabilityLabel}>Taux d'acceptation (30j)</Text>
                  <Text style={styles.reliabilityValue}>{d.driver.acceptance_rate.toFixed(0)}%</Text>
                </View>
              )}
              {d.driver.cancellation_rate != null && (
                <View style={styles.reliabilityCard}>
                  <Text style={styles.reliabilityLabel}>Taux d'annulation (30j)</Text>
                  <Text style={styles.reliabilityValue}>{d.driver.cancellation_rate.toFixed(0)}%</Text>
                </View>
              )}
            </View>
          )}

          {d.driver.status !== 'approved' && d.driver.status !== 'suspended' && (
            <DocumentsSection driver={d.driver} uploadingType={d.uploadingType} onUpload={d.handleUpload} />
          )}

          {d.driver.status === 'suspended' && (
            <View style={styles.suspendedCard}>
              <Text style={styles.suspendedText}>Votre compte chauffeur est suspendu. Contactez le support pour plus d'informations.</Text>
            </View>
          )}

          {d.driver.status === 'approved' && (
            <>
              <SubscriptionSection activeSub={d.activeSub} plans={d.plans} busy={d.busy} onBuyPlan={d.buyPlan} />

              {d.activeSub && !d.activeRide && (
                <AvailabilitySection
                  isAvailable={d.driver.is_available}
                  locationError={d.locationError}
                  offers={d.offers}
                  busy={d.busy}
                  onToggleAvailability={d.toggleAvailability}
                  onRespondToOffer={d.respondToOffer}
                />
              )}

              {d.activeRide && (
                <ActiveRideSection
                  activeRide={d.activeRide}
                  passengerInfo={d.passengerInfo}
                  busy={d.busy}
                  onAdvanceRide={d.advanceRide}
                  onReport={d.setReportRideId}
                />
              )}
            </>
          )}
        </ScrollView>
      )}

      {d.driver && (
        <ReportModal
          visible={d.reportRideId !== null}
          rideId={d.reportRideId}
          reporterId={d.driver.id}
          categories={REPORT_CATEGORIES}
          onClose={() => d.setReportRideId(null)}
        />
      )}

      {d.driver && (
        <ProfileModal
          visible={profileOpen}
          userId={d.driver.id}
          initialFullName={d.driverName}
          initialLanguage={d.driverLanguage}
          onClose={() => setProfileOpen(false)}
          onSaved={(fullName, language) => {
            d.setDriverName(fullName || null)
            d.setDriverLanguage(language)
          }}
        />
      )}

      {d.driver && d.rideToRate && d.rideToRate.ride.passenger_id && (
        <RatingModal
          visible
          rideId={d.rideToRate.ride.id}
          raterId={d.driver.id}
          raterRole="driver"
          rateeId={d.rideToRate.ride.passenger_id}
          rateeName={d.rideToRate.rateeName}
          onClose={() => d.setRideToRate(null)}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink50 },
  center: { flex: 1, backgroundColor: colors.ink50, alignItems: 'center', justifyContent: 'center' },
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
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 18 },
  badgeRow: { flexDirection: 'row', gap: 8 },
  vehicleText: { marginTop: 8, fontSize: 13, color: colors.ink600 },
  statsRow: { marginTop: 8, alignItems: 'flex-end' },
  statsText: { fontSize: 13, color: colors.ink600 },
  reliabilityRow: { flexDirection: 'row', gap: 8 },
  reliabilityCard: { flex: 1, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.ink100, borderRadius: 12, padding: 12, alignItems: 'center' },
  reliabilityLabel: { fontSize: 11, color: colors.ink400, textAlign: 'center' },
  reliabilityValue: { fontSize: 14, fontWeight: '700', color: colors.ink800, marginTop: 4 },
  suspendedCard: { backgroundColor: colors.red50, borderRadius: 16, borderWidth: 1, borderColor: '#fecaca', padding: 18 },
  suspendedText: { color: colors.red700, fontSize: 13 },
})
