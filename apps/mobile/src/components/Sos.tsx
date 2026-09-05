import { useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Location from 'expo-location'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'

interface SosButtonProps {
  rideId?: string | null
}

// Port de apps/web/src/components/Sos.tsx — écran transverse (docs/05-ecrans.md),
// toujours accessible, pas seulement pendant une course. `location` est
// `not null` en base (schéma initial) : sans position, l'alerte ne peut pas
// être envoyée.
export function SosButton({ rideId = null }: SosButtonProps) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function trigger() {
    setError(null)
    Alert.alert('Alerte SOS', 'Déclencher une alerte SOS ? Le support sera immédiatement notifié avec votre position.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déclencher',
        style: 'destructive',
        onPress: async () => {
          setBusy(true)
          const { status } = await Location.requestForegroundPermissionsAsync()
          if (status !== 'granted') {
            setBusy(false)
            setError('Autorisation de localisation refusée — activez-la puis réessayez.')
            return
          }
          try {
            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
            const { error: rpcError } = await supabase.rpc('trigger_sos', {
              _lat: position.coords.latitude,
              _lng: position.coords.longitude,
              _ride_id: rideId,
            })
            setBusy(false)
            if (rpcError) {
              setError(rpcError.message)
              return
            }
            setSent(true)
            setTimeout(() => setSent(false), 8000)
          } catch {
            setBusy(false)
            setError("Impossible d'obtenir votre position — réessayez.")
          }
        },
      },
    ])
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={trigger}
        disabled={busy}
        style={[styles.button, sent ? styles.buttonSent : styles.buttonDefault, { opacity: busy ? 0.5 : 1 }]}
      >
        <Text style={styles.buttonText}>{busy ? 'Envoi…' : sent ? '✓ Alerte envoyée' : '🆘 SOS'}</Text>
      </Pressable>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', gap: 4 },
  button: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  buttonDefault: { backgroundColor: colors.red700 },
  buttonSent: { backgroundColor: '#15803d' },
  buttonText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  error: { maxWidth: 160, textAlign: 'right', fontSize: 10, color: colors.red700 },
})
