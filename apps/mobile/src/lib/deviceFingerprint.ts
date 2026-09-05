import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import { supabase } from './supabase'

const STORAGE_KEY = 'vtc_device_id'

function generateDeviceId(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const id = generateDeviceId()
  await AsyncStorage.setItem(STORAGE_KEY, id)
  return id
}

// Port de apps/web/src/lib/deviceFingerprint.ts — anti-fraude « comptes
// multiples / appareils partagés » (docs/11-securite.md), voir TASK-049
// pour le raisonnement complet. Best-effort, jamais bloquant.
export async function registerDeviceFingerprint(userId: string): Promise<void> {
  try {
    const deviceId = await getOrCreateDeviceId()
    const { error } = await supabase
      .from('device_fingerprints')
      .insert({ user_id: userId, device_id: deviceId, platform: Platform.OS })
    if (error && error.code !== '23505') {
      console.warn('registerDeviceFingerprint: échec', error.message)
    }
  } catch (e) {
    console.warn('registerDeviceFingerprint: échec', e)
  }
}
