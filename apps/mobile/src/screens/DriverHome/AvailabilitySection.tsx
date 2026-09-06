import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { RideOffer } from '../../lib/types'
import { fcfa } from '../../lib/format'
import { colors } from '../../theme'

export function AvailabilitySection({
  isAvailable,
  locationError,
  offers,
  busy,
  onToggleAvailability,
  onRespondToOffer,
}: {
  isAvailable: boolean
  locationError: string | null
  offers: RideOffer[]
  busy: boolean
  onToggleAvailability: () => void
  onRespondToOffer: (offerId: string, accept: boolean) => void
}) {
  return (
    <View style={styles.card}>
      <View style={styles.availabilityHeader}>
        <Text style={styles.sectionTitle}>Disponibilité</Text>
        <Pressable
          disabled={busy}
          onPress={onToggleAvailability}
          style={[styles.availabilityButton, isAvailable ? styles.availabilityButtonOff : styles.availabilityButtonOn, { opacity: busy ? 0.5 : 1 }]}
        >
          <Text style={isAvailable ? styles.availabilityButtonOffText : styles.availabilityButtonOnText}>
            {isAvailable ? 'Se mettre indisponible' : 'Se mettre disponible'}
          </Text>
        </Pressable>
      </View>

      {isAvailable && locationError && (
        <View style={styles.locationErrorBox}>
          <Text style={styles.locationErrorText}>{locationError}</Text>
        </View>
      )}

      {isAvailable && !locationError && offers.length === 0 && <Text style={styles.subHint}>En attente d'une demande de course…</Text>}

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
            <Pressable disabled={busy} onPress={() => onRespondToOffer(offer.id, true)} style={[styles.primaryButtonSmall, { opacity: busy ? 0.5 : 1 }]}>
              <Text style={styles.primaryButtonSmallText}>Accepter</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={() => onRespondToOffer(offer.id, false)} style={[styles.dangerButtonSmall, { opacity: busy ? 0.5 : 1 }]}>
              <Text style={styles.dangerButtonSmallText}>Refuser</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  subHint: { fontSize: 13, color: colors.ink600, marginBottom: 8 },
  locationErrorBox: { backgroundColor: colors.red50, borderRadius: 10, padding: 12, marginBottom: 8 },
  locationErrorText: { color: colors.red700, fontSize: 13 },
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
})
