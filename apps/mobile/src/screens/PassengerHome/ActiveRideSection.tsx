import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { DriverPublicInfo, PassengerActiveRide } from '../../lib/types'
import { RideStatusBadge } from '../../components/Badge'
import { fcfa } from '../../lib/format'
import { colors } from '../../theme'

const CANCELLABLE_STATUSES = ['requested', 'searching', 'accepted', 'driver_arriving', 'driver_arrived']

export function ActiveRideSection({
  activeRide,
  driverInfo,
  busy,
  onCancel,
  onReport,
}: {
  activeRide: PassengerActiveRide
  driverInfo: DriverPublicInfo | null
  busy: boolean
  onCancel: () => void
  onReport: (rideId: string) => void
}) {
  return (
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
        {activeRide.estimated_fare_fcfa != null ? fcfa(activeRide.estimated_fare_fcfa) : '—'} — {activeRide.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}
      </Text>
      {CANCELLABLE_STATUSES.includes(activeRide.status) && (
        <Pressable disabled={busy} onPress={onCancel} style={[styles.dangerButton, { opacity: busy ? 0.5 : 1 }]}>
          <Text style={styles.dangerButtonText}>Annuler la course</Text>
        </Pressable>
      )}
      <Pressable onPress={() => onReport(activeRide.id)} style={styles.reportButton}>
        <Text style={styles.reportButtonText}>Signaler un problème</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
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
})
