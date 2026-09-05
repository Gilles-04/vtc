// Chargeur unique du script Maps JavaScript API — plusieurs LocationPicker
// sur le même écran (départ + destination) ne doivent injecter le script
// qu'une seule fois, d'où la promesse mise en cache plutôt qu'un chargement
// par composant.
let loadPromise: Promise<typeof google> | null = null

export function loadGoogleMaps(): Promise<typeof google> {
  if (loadPromise) return loadPromise

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY manquant — voir .env.example'))
  }

  loadPromise = new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google)
      return
    }

    const callbackName = '__vtcGoogleMapsLoaded'
    ;(window as unknown as Record<string, () => void>)[callbackName] = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName]
      resolve(window.google)
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=${callbackName}`
    script.async = true
    script.onerror = () => reject(new Error('Échec du chargement de Google Maps'))
    document.head.appendChild(script)
  })

  return loadPromise
}
