import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'

interface EmailOtpAuthProps {
  title: string
  emoji: string
  accentColor: string
  onAuthenticated: () => void
}

// Même flux à deux étapes que PassengerLogin.tsx / DriverLogin.tsx
// (apps/web) — email -> code reçu par email -> session. Un seul composant
// partagé ici, passager et chauffeur ne différant que par le titre/l'icône/
// la couleur d'accent et la destination après connexion.
export function EmailOtpAuth({ title, emoji, accentColor, onAuthenticated }: EmailOtpAuthProps) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSendCode() {
    setError(null)
    if (!email.trim()) {
      setError('Entrez votre email.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setStep('code')
  }

  async function handleVerifyCode() {
    setError(null)
    if (!code.trim()) {
      setError('Entrez le code reçu par email.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setLoading(false)
    if (error) {
      setError(error.message === 'Token has expired or is invalid' ? 'Code incorrect ou expiré.' : error.message)
      return
    }
    onAuthenticated()
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.headerBlock}>
        <View style={[styles.logo, { backgroundColor: accentColor }]}>
          <Text style={styles.logoEmoji}>{emoji}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>
          {step === 'email' ? 'Connectez-vous avec votre email' : 'Entrez le code reçu par email'}
        </Text>
      </View>

      <View style={styles.card}>
        {step === 'email' ? (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoFocus
              placeholder="vous@exemple.com"
              placeholderTextColor={colors.ink400}
              style={styles.input}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              disabled={loading}
              onPress={handleSendCode}
              style={[styles.button, { backgroundColor: accentColor, opacity: loading ? 0.5 : 1 }]}
            >
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Recevoir le code</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.hint}>
              Un code a été envoyé à <Text style={styles.hintBold}>{email}</Text>.
            </Text>
            <Text style={styles.label}>Code</Text>
            <TextInput
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoFocus
              placeholder="000000"
              placeholderTextColor={colors.ink400}
              style={[styles.input, styles.codeInput]}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              disabled={loading}
              onPress={handleVerifyCode}
              style={[styles.button, { backgroundColor: accentColor, opacity: loading ? 0.5 : 1 }]}
            >
              {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Valider</Text>}
            </Pressable>

            <Pressable
              onPress={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
              style={styles.linkButton}
            >
              <Text style={styles.linkText}>Changer d'email</Text>
            </Pressable>
          </>
        )}
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.ink50 },
  container: { flexGrow: 1, backgroundColor: colors.ink50, padding: 24, justifyContent: 'center' },
  headerBlock: { alignItems: 'center', marginBottom: 32 },
  logo: { height: 56, width: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoEmoji: { fontSize: 26 },
  title: { fontSize: 22, fontWeight: '700', color: colors.ink900 },
  subtitle: { fontSize: 14, color: colors.ink600, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 20 },
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
  codeInput: { textAlign: 'center', fontSize: 20, letterSpacing: 6 },
  hint: { fontSize: 14, color: colors.ink600, marginBottom: 16 },
  hintBold: { fontWeight: '600', color: colors.ink900 },
  error: { color: colors.red700, backgroundColor: colors.red50, borderRadius: 10, padding: 10, marginBottom: 16, fontSize: 13 },
  button: { borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
  linkButton: { marginTop: 14, alignItems: 'center' },
  linkText: { color: colors.ink600, fontSize: 13 },
})
