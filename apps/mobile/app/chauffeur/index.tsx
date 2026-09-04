import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { supabase } from '../../src/lib/supabase'
import { EmailOtpAuth } from '../../src/components/EmailOtpAuth'
import { colors } from '../../src/theme'

export default function DriverLogin() {
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/chauffeur/accueil')
        return
      }
      setCheckingSession(false)
    })
  }, [])

  if (checkingSession) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink50, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.gold600} />
      </View>
    )
  }

  return (
    <EmailOtpAuth
      title="Espace chauffeur"
      emoji="🚗"
      accentColor={colors.gold600}
      onAuthenticated={() => router.replace('/chauffeur/accueil')}
    />
  )
}
