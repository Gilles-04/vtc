import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors } from '../src/theme'

export default function Home() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoEmoji}>🚕</Text>
        </View>
        <Text style={styles.brand}>VTC Togo</Text>
      </View>

      <View style={styles.main}>
        <Text style={styles.title}>Votre course, en un clic — voiture ou moto-taxi</Text>
        <Text style={styles.subtitle}>Choisissez votre profil pour continuer.</Text>

        <Link href="/passager" asChild>
          <Pressable style={styles.card}>
            <Text style={styles.cardEmoji}>🧍</Text>
            <Text style={styles.cardTitle}>Je suis passager</Text>
            <Text style={styles.cardSubtitle}>Commander une course maintenant</Text>
          </Pressable>
        </Link>

        <Link href="/chauffeur" asChild>
          <Pressable style={styles.card}>
            <Text style={styles.cardEmoji}>🚗</Text>
            <Text style={styles.cardTitle}>Je suis chauffeur</Text>
            <Text style={styles.cardSubtitle}>Accéder à mon espace chauffeur</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink50 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 16 },
  logo: { height: 36, width: 36, borderRadius: 10, backgroundColor: colors.navy600, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 18 },
  brand: { fontSize: 18, fontWeight: '700', color: colors.ink900, marginLeft: 8 },
  main: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink900, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.ink600, textAlign: 'center', marginTop: 12, marginBottom: 32 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.ink100,
    backgroundColor: colors.white,
    padding: 20,
    marginBottom: 16,
  },
  cardEmoji: { fontSize: 24 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.ink900, marginTop: 10 },
  cardSubtitle: { fontSize: 13, color: colors.ink600, marginTop: 4 },
})
