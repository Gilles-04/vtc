import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import type { ActiveRideLocation } from '../lib/types'
import { CategoryBadge, RideStatusBadge } from '../components/Badge'

const LOME_CENTER: [number, number] = [6.1319, 1.2228]
const REFRESH_MS = 10000

// Pas de coordonnées `geography` renvoyées par le client Leaflet — on
// construit une icône simple (emoji) plutôt que les images marker.png/
// marker-shadow.png par défaut de Leaflet, dont les chemins ne résolvent
// pas correctement une fois packagés par Vite.
function emojiIcon(emoji: string, ring: string): ReturnType<typeof divIcon> {
  return divIcon({
    html: `<div style="font-size:20px;line-height:28px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:white;border:2px solid ${ring};border-radius:999px;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${emoji}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

const PICKUP_ICON = { car: emojiIcon('🚗', '#1e3a5f'), moto: emojiIcon('🏍️', '#1e3a5f') }
const DRIVER_ICON = { car: emojiIcon('🚗', '#e0ac1f'), moto: emojiIcon('🏍️', '#e0ac1f') }

// Écran #10 (docs/05-ecrans.md) : position temps réel des courses en
// cours, par catégorie. `admin_active_rides_locations()` n'est pas une
// table sur laquelle s'abonner en Realtime (RPC calculée) — rafraîchie
// par sondage, pas de flux poussé.
export function LiveMap() {
  const [rides, setRides] = useState<ActiveRideLocation[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    function load() {
      supabase
        .rpc('admin_active_rides_locations')
        .then(({ data, error }) => {
          if (cancelled) return
          if (error) setError(error.message)
          else setRides((data as ActiveRideLocation[]) ?? [])
        })
    }

    load()
    const interval = setInterval(load, REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const carCount = rides?.filter((r) => r.category === 'car').length ?? 0
  const motoCount = rides?.filter((r) => r.category === 'moto').length ?? 0

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">Carte live des courses</h1>
        {rides && (
          <p className="text-sm text-ink-600">
            {rides.length} course{rides.length > 1 ? 's' : ''} en cours — 🚗 {carCount} — 🏍️ {motoCount}
          </p>
        )}
      </div>

      {error && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-ink-100 shadow-sm lg:col-span-2">
          <MapContainer center={LOME_CENTER} zoom={13} style={{ height: '600px', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {rides?.map((r) => (
              <Marker key={`${r.id}-pickup`} position={[r.pickup_lat, r.pickup_lng]} icon={PICKUP_ICON[r.category]}>
                <Popup>
                  <p className="font-medium">Prise en charge</p>
                  <p>{r.category === 'car' ? 'Voiture' : 'Moto-taxi'} — {r.status}</p>
                </Popup>
              </Marker>
            ))}
            {rides
              ?.filter((r) => r.driver_lat != null && r.driver_lng != null)
              .map((r) => (
                <Marker key={`${r.id}-driver`} position={[r.driver_lat as number, r.driver_lng as number]} icon={DRIVER_ICON[r.category]}>
                  <Popup>
                    <p className="font-medium">Chauffeur</p>
                    <p>{r.category === 'car' ? 'Voiture' : 'Moto-taxi'} — {r.status}</p>
                  </Popup>
                </Marker>
              ))}
          </MapContainer>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Courses en cours</h2>
          {!rides && <p className="text-sm text-ink-400">Chargement…</p>}
          {rides && rides.length === 0 && <p className="text-sm text-ink-400">Aucune course en cours.</p>}
          <div className="space-y-2">
            {rides?.map((r) => (
              <div key={r.id} className="rounded-xl border border-ink-100 p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <CategoryBadge category={r.category} />
                  <RideStatusBadge status={r.status} />
                </div>
                <p className="text-xs text-ink-400">
                  {r.driver_lat != null ? 'Position chauffeur connue' : 'Position chauffeur indisponible'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
