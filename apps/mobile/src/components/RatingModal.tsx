import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'

interface RatingModalProps {
  visible: boolean
  rideId: string
  raterId: string
  raterRole: 'passenger' | 'driver'
  rateeId: string
  rateeName: string | null
  onClose: () => void
}

// Port de apps/web/src/components/RatingModal.tsx — écran #11
// (docs/05-ecrans.md, « Fin de course »), voir le composant web pour le
// raisonnement complet (TASK-047).
export function RatingModal({ visible, rideId, raterId, raterRole, rateeId, rateeName, onClose }: RatingModalProps) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setRating(0)
    setComment('')
    setError(null)
  }

  async function submit() {
    if (rating === 0) {
      setError('Choisissez une note de 1 à 5 étoiles.')
      return
    }
    setError(null)
    setBusy(true)
    const { error: insertError } = await supabase.from('ratings').insert({
      ride_id: rideId,
      rater_id: raterId,
      ratee_id: rateeId,
      rater_role: raterRole,
      rating,
      comment: comment.trim() || null,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    reset()
    onClose()
  }

  const label = raterRole === 'passenger' ? 'le chauffeur' : 'le passager'

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Notez {label}</Text>
          <Text style={styles.hint}>Course terminée avec {rateeName || label}.</Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)}>
                <Text style={[styles.star, n <= rating ? styles.starActive : styles.starInactive]}>★</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            placeholder="Un commentaire (optionnel)…"
            placeholderTextColor={colors.ink400}
            style={styles.textarea}
          />

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                reset()
                onClose()
              }}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Plus tard</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={submit} style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Envoi…' : 'Envoyer'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 22, 34, 0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  title: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 4 },
  hint: { fontSize: 13, color: colors.ink600, marginBottom: 16 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  star: { fontSize: 32 },
  starActive: { color: colors.gold500 },
  starInactive: { color: colors.ink100 },
  textarea: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink900,
    marginBottom: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  errorBox: { backgroundColor: colors.red50, borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: colors.red700, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '500', color: colors.ink600 },
  primaryButton: { flex: 1, backgroundColor: colors.navy600, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '600' },
})
