import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { SelectField } from './SelectField'
import { colors } from '../theme'

interface ReportModalProps {
  visible: boolean
  rideId: string | null
  reporterId: string
  categories: { value: string; label: string }[]
  onClose: () => void
}

// Port de apps/web/src/components/Report.tsx — écran #14 (docs/05-ecrans.md).
// `reported_user_id` volontairement laissé à null, voir le composant web.
export function ReportModal({ visible, rideId, reporterId, categories, onClose }: ReportModalProps) {
  const [category, setCategory] = useState(categories[0]?.value ?? '')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  function reset() {
    setCategory(categories[0]?.value ?? '')
    setDescription('')
    setError(null)
    setSent(false)
  }

  async function submit() {
    if (!description.trim()) {
      setError('Décrivez le problème rencontré.')
      return
    }
    setError(null)
    setBusy(true)
    const { error: insertError } = await supabase.from('reports').insert({
      ride_id: rideId,
      reporter_id: reporterId,
      category,
      description: description.trim(),
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSent(true)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {sent ? (
            <>
              <Text style={styles.title}>Signalement envoyé</Text>
              <Text style={styles.hint}>Merci, notre équipe va examiner votre signalement.</Text>
              <Pressable
                onPress={() => {
                  reset()
                  onClose()
                }}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Fermer</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Signaler un problème</Text>

              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.selectWrap}>
                <SelectField value={category} onChange={setCategory} options={categories} placeholder="Choisir…" />
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                placeholder="Décrivez ce qui s'est passé…"
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
                  <Text style={styles.secondaryButtonText}>Annuler</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={submit} style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}>
                  <Text style={styles.primaryButtonText}>{busy ? 'Envoi…' : 'Envoyer'}</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 22, 34, 0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  title: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  hint: { fontSize: 13, color: colors.ink600, marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink800, marginBottom: 6 },
  selectWrap: { marginBottom: 14 },
  textarea: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink900,
    marginBottom: 14,
    minHeight: 90,
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
