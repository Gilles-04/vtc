import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import type { DriverCategory, FareEstimate, PaymentMethodType, Zone } from '../../lib/types'
import { LocationPicker, type LocationValue } from '../../components/LocationPicker'
import { SelectField } from '../../components/SelectField'
import { fcfa } from '../../lib/format'
import { colors } from '../../theme'

export function RequestRideSection({
  category,
  onCategoryChange,
  pickup,
  onPickupChange,
  dropoff,
  onDropoffChange,
  zones,
  zoneId,
  onZoneIdChange,
  paymentMethod,
  onPaymentMethodChange,
  estimate,
  estimateError,
  estimating,
  busy,
  onEstimate,
  onConfirm,
}: {
  category: DriverCategory
  onCategoryChange: (category: DriverCategory) => void
  pickup: LocationValue
  onPickupChange: (value: LocationValue) => void
  dropoff: LocationValue
  onDropoffChange: (value: LocationValue) => void
  zones: Zone[]
  zoneId: string
  onZoneIdChange: (zoneId: string) => void
  paymentMethod: PaymentMethodType
  onPaymentMethodChange: (method: PaymentMethodType) => void
  estimate: FareEstimate | null
  estimateError: string | null
  estimating: boolean
  busy: boolean
  onEstimate: () => void
  onConfirm: () => void
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Demander une course</Text>

      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggle, category === 'car' && styles.toggleActive]} onPress={() => onCategoryChange('car')}>
          <Text style={category === 'car' ? styles.toggleTextActive : styles.toggleText}>🚗 Voiture</Text>
        </Pressable>
        <Pressable style={[styles.toggle, category === 'moto' && styles.toggleActive]} onPress={() => onCategoryChange('moto')}>
          <Text style={category === 'moto' ? styles.toggleTextActive : styles.toggleText}>🏍️ Moto-taxi</Text>
        </Pressable>
      </View>

      <LocationPicker label="Adresse de départ" placeholder="Ex : Grand Marché, Lomé" value={pickup} onChange={onPickupChange} />

      <LocationPicker
        label="Destination"
        placeholder="Ex : Aéroport de Lomé"
        value={dropoff}
        onChange={onDropoffChange}
        initialCenter={pickup.lat && pickup.lng ? { lat: Number(pickup.lat), lng: Number(pickup.lng) } : undefined}
      />

      {zones.length > 0 && (
        <>
          <Text style={styles.label}>Zone (optionnel)</Text>
          <View style={styles.selectWrap}>
            <SelectField
              value={zoneId}
              onChange={onZoneIdChange}
              placeholder="— Aucune —"
              options={[{ value: '', label: '— Aucune —' }, ...zones.map((z) => ({ value: z.id, label: `${z.name} (${z.city})` }))]}
            />
          </View>
        </>
      )}

      <Text style={styles.label}>Paiement</Text>
      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggle, paymentMethod === 'cash' && styles.toggleActive]} onPress={() => onPaymentMethodChange('cash')}>
          <Text style={paymentMethod === 'cash' ? styles.toggleTextActive : styles.toggleText}>💵 Cash</Text>
        </Pressable>
        <Pressable style={[styles.toggle, paymentMethod === 'mobile_money' && styles.toggleActive]} onPress={() => onPaymentMethodChange('mobile_money')}>
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
        <Pressable disabled={estimating} onPress={onEstimate} style={[styles.primaryButton, { opacity: estimating ? 0.5 : 1 }]}>
          {estimating ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Estimer le prix</Text>}
        </Pressable>
      )}
      {estimate && (
        <Pressable disabled={busy} onPress={onConfirm} style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.primaryButtonText}>Confirmer la demande</Text>}
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggle: { flex: 1, borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  toggleActive: { borderColor: colors.navy500, backgroundColor: colors.navy50 },
  toggleText: { fontSize: 13, fontWeight: '500', color: colors.ink600 },
  toggleTextActive: { fontSize: 13, fontWeight: '600', color: colors.navy700 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink800, marginBottom: 6 },
  selectWrap: { marginBottom: 12 },
  errorInline: { backgroundColor: colors.red50, borderRadius: 10, padding: 10, marginBottom: 12 },
  errorText: { color: colors.red700, fontSize: 13 },
  estimateBox: { backgroundColor: colors.navy50, borderRadius: 10, padding: 12, marginBottom: 12 },
  estimateFare: { fontSize: 15, fontWeight: '700', color: colors.navy700 },
  estimateDetail: { fontSize: 12, color: colors.navy600, marginTop: 2 },
  primaryButton: { backgroundColor: colors.navy600, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 15, fontWeight: '600' },
})
