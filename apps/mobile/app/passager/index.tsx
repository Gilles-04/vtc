import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../../src/lib/supabase'
import { EmailOtpAuth } from '../../src/components/EmailOtpAuth'
import { SelectField } from '../../src/components/SelectField'
import { colors } from '../../src/theme'

const LANGUAGE_OPTIONS = [
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
]

export default function PassengerLogin() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [phase, setPhase] = useState<'intro' | 'auth' | 'profile'>('intro')
  const [fullName, setFullName] = useState('')
  const [language, setLanguage] = useState('fr')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/passager/accueil')
        return
      }
      setCheckingSession(false)
    })
  }, [])

  // Écran #4 (docs/05-ecrans.md) : uniquement pour un tout nouveau compte —
  // voir apps/web/src/pages/PassengerLogin.tsx pour le même raisonnement
  // (`handle_new_user`, migration 1, ne renseigne jamais `full_name`).
  async function handleAuthenticated() {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    const { data: profile } = uid
      ? await supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle()
      : { data: null }
    if (!profile?.full_name) {
      setPhase('profile')
      return
    }
    router.replace('/passager/accueil')
  }

  async function submitProfile() {
    setError(null)
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() || null, language })
      .eq('id', uid)
    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    router.replace('/passager/accueil')
  }

  if (checkingSession) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.navy600} />
      </View>
    )
  }

  if (phase === 'intro') {
    return (
      <View style={styles.introScreen}>
        <View style={styles.headerBlock}>
          <View style={[styles.logo, { backgroundColor: colors.navy600 }]}>
            <Text style={styles.logoEmoji}>🧍</Text>
          </View>
          <Text style={styles.title}>Espace passager</Text>
          <Text style={styles.subtitle}>Réservez une course en quelques secondes, à Lomé.</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.hint}>
            VTC Togo vous met en relation avec un chauffeur voiture ou moto-taxi, avec un prix connu avant de
            commander.
          </Text>
          <Pressable onPress={() => setPhase('auth')} style={[styles.button, { backgroundColor: colors.navy600 }]}>
            <Text style={styles.buttonText}>Continuer</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  if (phase === 'profile') {
    return (
      <View style={styles.introScreen}>
        <View style={styles.headerBlock}>
          <View style={[styles.logo, { backgroundColor: colors.navy600 }]}>
            <Text style={styles.logoEmoji}>🧍</Text>
          </View>
          <Text style={styles.title}>Bienvenue</Text>
          <Text style={styles.subtitle}>Quelques informations avant de commencer</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Votre nom</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            autoFocus
            placeholder="Ex : Ama Koffi"
            placeholderTextColor={colors.ink400}
            style={styles.input}
          />

          <Text style={styles.label}>Langue</Text>
          <View style={styles.selectWrap}>
            <SelectField value={language} onChange={setLanguage} options={LANGUAGE_OPTIONS} placeholder="Choisir…" />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            disabled={saving}
            onPress={submitProfile}
            style={[styles.button, { backgroundColor: colors.navy600, opacity: saving ? 0.5 : 1 }]}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Commencer</Text>}
          </Pressable>
        </View>
      </View>
    )
  }

  return <EmailOtpAuth title="Espace passager" emoji="🧍" accentColor={colors.navy600} onAuthenticated={handleAuthenticated} />
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.ink50, alignItems: 'center', justifyContent: 'center' },
  introScreen: { flex: 1, backgroundColor: colors.ink50, padding: 24, justifyContent: 'center' },
  headerBlock: { alignItems: 'center', marginBottom: 32 },
  logo: { height: 56, width: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoEmoji: { fontSize: 26 },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink900 },
  subtitle: { fontSize: 14, color: colors.ink600, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 20 },
  hint: { fontSize: 14, color: colors.ink600, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink800, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink900,
    marginBottom: 16,
  },
  selectWrap: { marginBottom: 16 },
  error: { color: colors.red700, backgroundColor: colors.red50, borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 13 },
  button: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
})
