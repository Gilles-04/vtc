import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { RideHistoryRow } from '../../lib/types'
import { CategoryBadge, RideStatusBadge } from '../../components/Badge'
import { fcfa } from '../../lib/format'
import { colors } from '../../theme'

export function HistorySection({ history, onReport }: { history: RideHistoryRow[]; onReport: (rideId: string) => void }) {
  return (
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
            <Text style={styles.historyDate}>{new Date(r.requested_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>
            <Text style={styles.historyDate}>{(r.final_fare_fcfa ?? r.estimated_fare_fcfa) != null ? fcfa((r.final_fare_fcfa ?? r.estimated_fare_fcfa) as number) : '—'}</Text>
          </View>
          <Pressable onPress={() => onReport(r.id)} style={styles.historyReportButton}>
            <Text style={styles.historyReportButtonText}>Signaler</Text>
          </Pressable>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyRow: { borderWidth: 1, borderColor: colors.ink100, borderRadius: 12, padding: 12, marginBottom: 8, gap: 6 },
  historyAddress: { fontSize: 13, color: colors.ink600 },
  historyDate: { fontSize: 11, color: colors.ink400 },
  historyReportButton: { marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.ink100, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  historyReportButtonText: { fontSize: 11, fontWeight: '500', color: colors.ink400 },
})
