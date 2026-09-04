import { useEffect, useState } from 'react'
import { router } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { supabase } from '../../src/lib/supabase'
import { EmailOtpAuth } from '../../src/components/EmailOtpAuth'
import { colors } from '../../src/theme'

export default function PassengerLogin() {
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/passager/accueil')
        return
      }
      setCheckingSession(false)
    })
  }, [])

  if (checkingSession) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink50, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.navy600} />
      </View>
    )
  }

  return (
    <EmailOtpAuth
      title="Espace passager"
      emoji="🧍"
      accentColor={colors.navy600}
      onAuthenticated={() => router.replace('/passager/accueil')}
    />
  )
}
