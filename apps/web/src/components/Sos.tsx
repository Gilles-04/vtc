import { useState } from 'react'
import { supabase } from '../lib/supabase'

interface SosButtonProps {
  rideId?: string | null
}

// Écran transverse (docs/05-ecrans.md) — toujours accessible, pas seulement
// pendant une course : `_ride_id` est simplement rattaché à l'alerte quand
// une course est en cours, pour aider l'équipe à réagir plus vite (voir
// `trigger_sos`, migration 18). `location` est `not null` en base (schéma
// initial) : sans position, l'alerte ne peut pas être envoyée — message
// d'erreur actionnable plutôt qu'un envoi sans localisation.
export function SosButton({ rideId = null }: SosButtonProps) {
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function trigger() {
    setError(null)
    if (!window.confirm('Déclencher une alerte SOS ? Le support sera immédiatement notifié avec votre position.')) return
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.")
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        supabase
          .rpc('trigger_sos', {
            _lat: position.coords.latitude,
            _lng: position.coords.longitude,
            _ride_id: rideId,
          })
          .then(({ error: rpcError }) => {
            setBusy(false)
            if (rpcError) {
              setError(rpcError.message)
              return
            }
            setSent(true)
            setTimeout(() => setSent(false), 8000)
          })
      },
      () => {
        setBusy(false)
        setError("Impossible d'obtenir votre position — activez la localisation puis réessayez.")
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={trigger}
        disabled={busy}
        className={`rounded-full px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50 ${
          sent ? 'bg-green-600' : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        {busy ? 'Envoi…' : sent ? '✓ Alerte envoyée' : '🆘 SOS'}
      </button>
      {error && <p className="max-w-[180px] text-right text-[11px] text-red-600">{error}</p>}
    </div>
  )
}
