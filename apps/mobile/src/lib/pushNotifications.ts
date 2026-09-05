import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import { supabase } from './supabase'

// Câble `profiles.push_token` (migration 4) — colonne prête depuis le
// début du projet mais jamais renseignée par aucun client : le pipeline
// serveur (trigger sur `notifications` -> push-notifications-dispatch ->
// API push Expo) tournait déjà pour de vrai, mais sans un seul jeton
// enregistré (vérifié : 0 profil sur 6 avec un push_token en production)
// aucune notification n'a jamais pu être livrée. `EXPO_PUBLIC_PROJECT_ID`
// (jamais fourni jusqu'ici, voir .env.example racine) est indispensable à
// `getExpoPushTokenAsync` — sans lui, on abandonne silencieusement plutôt
// que de planter le reste de l'app pour une fonctionnalité annexe.
//
// Limite connue d'Expo (pas de ce projet) : depuis le SDK 53, Expo Go ne
// reçoit plus les notifications push distantes sur Android — un build de
// développement (`eas build --profile development`) est nécessaire pour
// tester la réception réelle, Expo Go seul ne suffit plus une fois le
// jeton obtenu.
export async function registerForPushNotifications(userId: string): Promise<void> {
  const projectId = process.env.EXPO_PUBLIC_PROJECT_ID
  if (!projectId) {
    console.warn('registerForPushNotifications: EXPO_PUBLIC_PROJECT_ID manquant — enregistrement ignoré.')
    return
  }

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      })
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }
    if (finalStatus !== 'granted') return

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })

    const { error } = await supabase.from('profiles').update({ push_token: token }).eq('id', userId)
    if (error) console.warn('registerForPushNotifications: écriture push_token échouée', error.message)
  } catch (e) {
    // Best-effort — un échec d'enregistrement push ne doit jamais bloquer
    // le reste de l'application.
    console.warn('registerForPushNotifications: échec', e)
  }
}
