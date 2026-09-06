import type { RideOffer } from '../../lib/types'
import { fcfa } from '../../lib/format'

export function AvailabilitySection({
  isAvailable,
  locationError,
  offers,
  busy,
  onToggleAvailability,
  onRespondToOffer,
}: {
  isAvailable: boolean
  locationError: string | null
  offers: RideOffer[]
  busy: boolean
  onToggleAvailability: () => void
  onRespondToOffer: (offerId: string, accept: boolean) => void
}) {
  return (
    <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Disponibilité</h2>
        <button
          disabled={busy}
          onClick={onToggleAvailability}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold disabled:opacity-50 ${
            isAvailable ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-navy-600 text-white hover:bg-navy-700'
          }`}
        >
          {isAvailable ? 'Se mettre indisponible' : 'Se mettre disponible'}
        </button>
      </div>

      {isAvailable && locationError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{locationError}</div>}

      {isAvailable && !locationError && offers.length === 0 && <p className="text-sm text-ink-400">En attente d'une demande de course…</p>}

      {offers.map((offer) => (
        <div key={offer.id} className="mt-2 rounded-xl border border-gold-500 bg-gold-400/10 p-4">
          <p className="text-sm text-ink-600">
            {offer.rides.pickup_address} → {offer.rides.dropoff_address}
          </p>
          <p className="mt-1 text-sm font-medium text-ink-800">
            {offer.rides.estimated_fare_fcfa != null ? fcfa(offer.rides.estimated_fare_fcfa) : '—'}
            {offer.rides.estimated_distance_km != null && ` — ${offer.rides.estimated_distance_km} km`}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={() => onRespondToOffer(offer.id, true)}
              className="rounded-lg bg-navy-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
            >
              Accepter
            </button>
            <button
              disabled={busy}
              onClick={() => onRespondToOffer(offer.id, false)}
              className="rounded-lg bg-red-50 px-4 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Refuser
            </button>
          </div>
        </div>
      ))}
    </section>
  )
}
