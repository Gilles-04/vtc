import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { ActiveSubscription, SubscriptionPlan } from '../../lib/types'
import { Badge } from '../../components/Badge'
import { fcfa } from '../../lib/format'
import { colors } from '../../theme'

export function SubscriptionSection({
  activeSub,
  plans,
  busy,
  onBuyPlan,
}: {
  activeSub: ActiveSubscription | null
  plans: SubscriptionPlan[]
  busy: boolean
  onBuyPlan: (planCode: string) => void
}) {
  return (
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
                onPress={() => onBuyPlan(p.code)}
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
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 18 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  subActiveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subName: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  subExpiry: { fontSize: 12, color: colors.ink400, marginTop: 2 },
  subHint: { fontSize: 13, color: colors.ink600, marginBottom: 8 },
  planRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.ink100, borderRadius: 12, padding: 12, marginBottom: 8 },
  planName: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  planPrice: { fontSize: 12, color: colors.ink400, marginTop: 2 },
  primaryButtonSmall: { backgroundColor: colors.navy600, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  primaryButtonSmallText: { color: colors.white, fontSize: 13, fontWeight: '600' },
})
