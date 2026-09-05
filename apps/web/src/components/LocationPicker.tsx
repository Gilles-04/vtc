import { useEffect, useRef, useState } from 'react'
import { loadGoogleMaps } from '../lib/googleMaps'

export interface LocationValue {
  address: string
  lat: string
  lng: string
}

interface LocationPickerProps {
  label: string
  placeholder: string
  value: LocationValue
  onChange: (value: LocationValue) => void
  // Centre initial de la carte tant qu'aucune position n'est encore choisie
  // (ex : la position de départ déjà sélectionnée, pour le picker de
  // destination) — sinon Lomé par défaut.
  initialCenter?: { lat: number; lng: number }
}

const LOME_CENTER = { lat: 6.1319, lng: 1.2228 }

// Beaucoup d'adresses au Togo ne sont pas indexées (pas de recherche
// textuelle fiable) — plutôt qu'une auto-complétion Places (dont la
// compatibilité avec une clé restreinte à « Places API (New) » n'est pas
// garantie pour le composant `Autocomplete` historique), on mise sur ce
// que l'utilisateur maîtrise réellement : sa position GPS + un point qu'il
// ajuste lui-même sur la carte. Le texte reste un champ libre, prérempli
// par géocodage inverse quand disponible mais jamais bloquant s'il échoue
// (Geocoding API pas forcément activée) — le prix/l'itinéraire ne dépend
// que des coordonnées, jamais du texte de l'adresse.
export function LocationPicker({ label, placeholder, value, onChange, initialCenter }: LocationPickerProps) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  const [mapError, setMapError] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  function applyPosition(lat: number, lng: number, addressOverride?: string) {
    markerRef.current?.setPosition({ lat, lng })
    mapRef.current?.panTo({ lat, lng })

    if (addressOverride) {
      onChange({ address: addressOverride, lat: String(lat), lng: String(lng) })
      return
    }

    // Le texte tapé manuellement par l'utilisateur n'est jamais écrasé —
    // seul un champ encore vide se voit proposer un géocodage inverse.
    const keepManualAddress = valueRef.current.address.trim().length > 0
    onChange({ address: keepManualAddress ? valueRef.current.address : '', lat: String(lat), lng: String(lng) })

    if (!keepManualAddress && geocoderRef.current) {
      geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          onChange({ address: results[0].formatted_address, lat: String(lat), lng: String(lng) })
        }
      })
    }
  }

  useEffect(() => {
    let cancelled = false

    loadGoogleMaps()
      .then((g) => {
        if (cancelled || !mapDivRef.current) return

        const start =
          value.lat && value.lng ? { lat: Number(value.lat), lng: Number(value.lng) } : (initialCenter ?? LOME_CENTER)

        const map = new g.maps.Map(mapDivRef.current, {
          center: start,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        })
        mapRef.current = map
        geocoderRef.current = new g.maps.Geocoder()

        const marker = new g.maps.Marker({ map, position: start, draggable: true })
        markerRef.current = marker

        marker.addListener('dragend', () => {
          const pos = marker.getPosition()
          if (pos) applyPosition(pos.lat(), pos.lng())
        })
        map.addListener('click', (e: google.maps.MapMouseEvent) => {
          if (e.latLng) applyPosition(e.latLng.lat(), e.latLng.lng())
        })
      })
      .catch(() => setMapError('Impossible de charger la carte — vérifiez votre connexion.'))

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function useMyLocation() {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError("La géolocalisation n'est pas disponible sur cet appareil.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        mapRef.current?.setZoom(16)
        // Une géolocalisation explicitement demandée doit remplacer une
        // éventuelle adresse tapée à la main — contrairement au clic/glisser
        // sur la carte, qui la préserve.
        onChange({ address: '', lat: '', lng: '' })
        applyPosition(position.coords.latitude, position.coords.longitude)
      },
      () => {
        setLocating(false)
        setLocationError("Position refusée ou indisponible — choisissez un point sur la carte.")
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div className="mb-4">
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-sm font-medium text-ink-800">{label}</label>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="text-xs font-medium text-navy-600 hover:underline disabled:opacity-50"
        >
          {locating ? 'Localisation…' : '📍 Ma position'}
        </button>
      </div>
      <input
        type="text"
        value={value.address}
        onChange={(e) => onChange({ ...value, address: e.target.value })}
        placeholder={placeholder}
        className="mb-2 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
      />
      {mapError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{mapError}</p>
      ) : (
        <div ref={mapDivRef} className="h-48 w-full overflow-hidden rounded-lg border border-ink-100" />
      )}
      <p className="mt-1 text-xs text-ink-400">Touchez la carte ou faites glisser le repère pour ajuster le point exact.</p>
      {locationError && <p className="mt-1 text-xs text-red-600">{locationError}</p>}
    </div>
  )
}
