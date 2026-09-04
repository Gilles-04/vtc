import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

// Stub — accueil réel (historique + demande de course) déjà construit côté
// apps/web (PassengerHome.tsx, TASK-031/032) : à porter ici une fois l'app
// mobile sortie de sa phase 1 (auth), voir docs/12-roadmap.md.
export default function PassengerHome() {
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace('/passager')
        return
      }
      setChecking(false)
    })
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/passager')
  }

  if (checking) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.navy600} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoEmoji}>🚕</Text>
          </View>
          <Text style={styles.brand}>VTC Togo</Text>
        </View>
        <Pressable onPress={handleSignOut}>
          <Text style={styles.signOut}>Se déconnecter</Text>
        </Pressable>
      </View>

      <View style={styles.main}>
        <Text style={styles.emoji}>🚧</Text>
        <Text style={styles.title}>Compte connecté</Text>
        <Text style={styles.subtitle}>
          La demande de course arrive prochainement sur mobile — déjà disponible sur la version web.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink50 },
  center: { flex: 1, backgroundColor: colors.ink50, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { height: 36, width: 36, borderRadius: 10, backgroundColor: colors.navy600, alignItems: 'center', justifyContent: 'center' },
  logoEmoji: { fontSize: 18 },
  brand: { fontSize: 18, fontWeight: '700', color: colors.ink900, marginLeft: 8 },
  signOut: { fontSize: 13, fontWeight: '600', color: colors.ink600 },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emoji: { fontSize: 32 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink900, marginTop: 16 },
  subtitle: { fontSize: 14, color: colors.ink600, textAlign: 'center', marginTop: 8 },
})
