import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../lib/supabase'
import type { DriverCategory } from '../lib/types'
import { colors } from '../theme'

// Port direct de apps/web/src/pages/DriverOnboarding.tsx — même RPC, même
// validation, UI native.
export function DriverOnboarding({ onSubmitted }: { onSubmitted: () => void }) {
  const [category, setCategory] = useState<DriverCategory>('car')
  const [city, setCity] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [color, setColor] = useState('')
  const [plate, setPlate] = useState('')
  const [year, setYear] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    if (!city.trim() || !brand.trim() || !model.trim() || !color.trim() || !plate.trim()) {
      setError('Tous les champs sont obligatoires (sauf année).')
      return
    }
    setLoading(true)
    const { error } = await supabase.rpc('submit_driver_application', {
      _category: category,
      _city: city.trim(),
      _vehicle_brand: brand.trim(),
      _vehicle_model: model.trim(),
      _vehicle_color: color.trim(),
      _vehicle_plate: plate.trim(),
      _vehicle_year: year ? Number(year) : null,
    })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    onSubmitted()
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Devenir chauffeur</Text>
        <Text style={styles.subtitle}>
          Renseignez votre véhicule pour commencer — les documents (pièce d'identité, permis...) se soumettent à
          l'étape suivante.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.row}>
            <Pressable
              style={[styles.toggle, category === 'car' && styles.toggleActive]}
              onPress={() => setCategory('car')}
            >
              <Text style={category === 'car' ? styles.toggleTextActive : styles.toggleText}>🚗 Voiture</Text>
            </Pressable>
            <Pressable
              style={[styles.toggle, category === 'moto' && styles.toggleActive]}
              onPress={() => setCategory('moto')}
            >
              <Text style={category === 'moto' ? styles.toggleTextActive : styles.toggleText}>🏍️ Moto-taxi</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Ville</Text>
          <TextInput value={city} onChangeText={setCity} placeholder="Lomé" placeholderTextColor={colors.ink400} style={styles.input} />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Marque</Text>
              <TextInput value={brand} onChangeText={setBrand} style={styles.input} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Modèle</Text>
              <TextInput value={model} onChangeText={setModel} style={styles.input} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.label}>Couleur</Text>
              <TextInput value={color} onChangeText={setColor} style={styles.input} />
            </View>
            <View style={styles.half}>
              <Text style={styles.label}>Année</Text>
              <TextInput value={year} onChangeText={setYear} keyboardType="number-pad" style={styles.input} />
            </View>
          </View>

          <Text style={styles.label}>Plaque d'immatriculation</Text>
          <TextInput value={plate} onChangeText={setPlate} style={styles.input} />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable disabled={loading} onPress={handleSubmit} style={[styles.button, { opacity: loading ? 0.5 : 1 }]}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Continuer</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.ink50 },
  container: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink900, marginBottom: 4 },
  subtitle: { fontSize: 13, color: colors.ink600, marginBottom: 20 },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.ink100, padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink800, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink900 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  toggle: { flex: 1, borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  toggleActive: { borderColor: colors.navy500, backgroundColor: colors.navy50 },
  toggleText: { fontSize: 13, fontWeight: '500', color: colors.ink600 },
  toggleTextActive: { fontSize: 13, fontWeight: '600', color: colors.navy700 },
  error: { color: colors.red700, backgroundColor: colors.red50, borderRadius: 10, padding: 10, marginTop: 16, fontSize: 13 },
  button: { backgroundColor: colors.navy600, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 20 },
  buttonText: { color: colors.white, fontWeight: '600', fontSize: 15 },
})
