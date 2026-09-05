import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { SelectField } from './SelectField'
import { colors } from '../theme'

interface ProfileModalProps {
  visible: boolean
  userId: string
  initialFullName: string | null
  initialLanguage: string
  onClose: () => void
  onSaved: (fullName: string, language: string) => void
}

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
]

// Port de apps/web/src/components/Profile.tsx — écran transverse
// Profil/Paramètres (docs/05-ecrans.md).
export function ProfileModal({ visible, userId, initialFullName, initialLanguage, onClose, onSaved }: ProfileModalProps) {
  const [fullName, setFullName] = useState(initialFullName ?? '')
  const [language, setLanguage] = useState(initialLanguage)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setBusy(true)
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null, language })
      .eq('id', userId)
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    onSaved(fullName.trim(), language)
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Profil</Text>

          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Votre nom"
            placeholderTextColor={colors.ink400}
            style={styles.input}
          />

          <Text style={styles.label}>Langue</Text>
          <View style={styles.selectWrap}>
            <SelectField value={language} onChange={setLanguage} options={LANGUAGE_OPTIONS} placeholder="Choisir…" />
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Annuler</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={submit} style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}>
              <Text style={styles.primaryButtonText}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Text>
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
  title: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink800, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink900, marginBottom: 14 },
  selectWrap: { marginBottom: 14 },
  errorBox: { backgroundColor: colors.red50, borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: colors.red700, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '500', color: colors.ink600 },
  primaryButton: { flex: 1, backgroundColor: colors.navy600, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '600' },
})
