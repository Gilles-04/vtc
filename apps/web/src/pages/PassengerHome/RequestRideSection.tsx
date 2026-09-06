import type { FormEvent } from 'react'
import type { DriverCategory, FareEstimate, PaymentMethodType, Zone } from '../../lib/types'
import { LocationPicker, type LocationValue } from '../../components/LocationPicker'
import { fcfa } from '../../lib/format'

export function RequestRideSection({
  category,
  onCategoryChange,
  pickup,
  onPickupChange,
  dropoff,
  onDropoffChange,
  zones,
  zoneId,
  onZoneIdChange,
  paymentMethod,
  onPaymentMethodChange,
  estimate,
  estimateError,
  estimating,
  busy,
  onEstimate,
  onConfirm,
}: {
  category: DriverCategory
  onCategoryChange: (category: DriverCategory) => void
  pickup: LocationValue
  onPickupChange: (value: LocationValue) => void
  dropoff: LocationValue
  onDropoffChange: (value: LocationValue) => void
  zones: Zone[]
  zoneId: string
  onZoneIdChange: (zoneId: string) => void
  paymentMethod: PaymentMethodType
  onPaymentMethodChange: (method: PaymentMethodType) => void
  estimate: FareEstimate | null
  estimateError: string | null
  estimating: boolean
  busy: boolean
  onEstimate: (e: FormEvent) => void
  onConfirm: () => void
}) {
  return (
    <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-ink-400">Demander une course</h2>

      <form onSubmit={onEstimate}>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onCategoryChange('car')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              category === 'car' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
            }`}
          >
            🚗 Voiture
          </button>
          <button
            type="button"
            onClick={() => onCategoryChange('moto')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              category === 'moto' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
            }`}
          >
            🏍️ Moto-taxi
          </button>
        </div>

        <LocationPicker label="Adresse de départ" placeholder="Ex : Grand Marché, Lomé" value={pickup} onChange={onPickupChange} />

        <LocationPicker
          label="Destination"
          placeholder="Ex : Aéroport de Lomé"
          value={dropoff}
          onChange={onDropoffChange}
          initialCenter={pickup.lat && pickup.lng ? { lat: Number(pickup.lat), lng: Number(pickup.lng) } : undefined}
        />

        {zones.length > 0 && (
          <>
            <label className="mb-1 block text-sm font-medium text-ink-800">Zone (optionnel)</label>
            <select
              value={zoneId}
              onChange={(e) => onZoneIdChange(e.target.value)}
              className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink-800"
            >
              <option value="">— Aucune —</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.city})
                </option>
              ))}
            </select>
          </>
        )}

        <label className="mb-1 block text-sm font-medium text-ink-800">Paiement</label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPaymentMethodChange('cash')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              paymentMethod === 'cash' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
            }`}
          >
            💵 Cash
          </button>
          <button
            type="button"
            onClick={() => onPaymentMethodChange('mobile_money')}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              paymentMethod === 'mobile_money' ? 'border-navy-500 bg-navy-50 text-navy-700' : 'border-ink-100 text-ink-600'
            }`}
          >
            📱 Mobile Money
          </button>
        </div>

        {estimateError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estimateError}</p>}

        {estimate && (
          <div className="mb-4 rounded-lg bg-navy-50 px-3 py-3 text-sm text-navy-800">
            <p className="font-semibold">{fcfa(estimate.fare_fcfa)}</p>
            <p className="text-xs text-navy-600">
              {estimate.distance_km} km — {estimate.duration_min} min{estimate.is_night ? ' — tarif de nuit' : ''}
            </p>
          </div>
        )}

        {!estimate && (
          <button
            type="submit"
            disabled={estimating}
            className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {estimating ? 'Estimation…' : 'Estimer le prix'}
          </button>
        )}
        {estimate && (
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {busy ? 'Envoi…' : 'Confirmer la demande'}
          </button>
        )}
      </form>
    </section>
  )
}
