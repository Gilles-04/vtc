import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ActiveRide, PassengerPublicInfo } from '../../lib/types'
import { RideStatusBadge } from '../../components/Badge'
import { fcfa } from '../../lib/format'
import { colors } from '../../theme'

export function ActiveRideSection({
  activeRide,
  passengerInfo,
  busy,
  onAdvanceRide,
  onReport,
}: {
  activeRide: ActiveRide
  passengerInfo: PassengerPublicInfo | null
  busy: boolean
  onAdvanceRide: () => void
  onReport: (rideId: string) => void
}) {
  return (
    <View style={styles.activeRideCard}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Course en cours</Text>
        <RideStatusBadge status={activeRide.status} />
      </View>
      <Text style={styles.passengerName}>{passengerInfo?.full_name || 'Passager'}</Text>
      <Text style={styles.rideAddress}>
        {activeRide.pickup_address} → {activeRide.dropoff_address}
      </Text>
      <Text style={styles.rideFare}>
        {activeRide.estimated_fare_fcfa != null ? fcfa(activeRide.estimated_fare_fcfa) : '—'} — {activeRide.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}
      </Text>
      <Pressable disabled={busy} onPress={onAdvanceRide} style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}>
        <Text style={styles.primaryButtonText}>
          {activeRide.status === 'accepted' || activeRide.status === 'driver_arriving'
            ? 'Signaler mon arrivée'
            : activeRide.status === 'driver_arrived'
              ? 'Démarrer la course'
              : 'Terminer la course'}
        </Text>
      </Pressable>
      <Pressable onPress={() => onReport(activeRide.id)} style={styles.reportButton}>
        <Text style={styles.reportButtonText}>Signaler un problème</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  activeRideCard: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.navy500, padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400 },
  passengerName: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  rideAddress: { marginTop: 6, fontSize: 13, color: colors.ink600 },
  rideFare: { marginTop: 4, fontSize: 13, color: colors.ink600 },
  primaryButton: { marginTop: 14, backgroundColor: colors.navy600, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  reportButton: { marginTop: 8, borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  reportButtonText: { fontSize: 12, fontWeight: '500', color: colors.ink400 },
})
