import { supabase } from './supabase'

const STORAGE_KEY = 'vtc_device_id'

function generateDeviceId(): string {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (existing) return existing
    const id = generateDeviceId()
    localStorage.setItem(STORAGE_KEY, id)
    return id
  } catch {
    // localStorage indisponible (navigation privée stricte, etc.) — un
    // identifiant jetable évite de planter l'appelant, au prix de ne
    // jamais redétecter ce même appareil à la session suivante.
    return generateDeviceId()
  }
}

// Anti-fraude « comptes multiples / appareils partagés »
// (docs/11-securite.md) — `device_fingerprints` a sa RLS et son trigger
// (`flag_device_duplicate`, écrit dans `fraud_flags` dès qu'un même
// device_id est associé à plus d'un compte) prêts depuis la migration 1,
// vérifiés en local à l'époque, mais aucun client ne les a jamais
// appelés (0 ligne en production, voir TASK-049). Best-effort, jamais
// bloquant : la contrainte unique (user_id, device_id) rejette
// silencieusement les enregistrements répétés (aucune politique UPDATE
// prévue — un seul insert par paire suffit à ce mécanisme).
export async function registerDeviceFingerprint(userId: string): Promise<void> {
  try {
    const deviceId = getOrCreateDeviceId()
    const { error } = await supabase.from('device_fingerprints').insert({ user_id: userId, device_id: deviceId, platform: 'web' })
    if (error && error.code !== '23505') {
      console.warn('registerDeviceFingerprint: échec', error.message)
    }
  } catch (e) {
    console.warn('registerDeviceFingerprint: échec', e)
  }
}
