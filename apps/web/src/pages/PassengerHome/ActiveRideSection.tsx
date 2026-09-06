import type { DriverPublicInfo, PassengerActiveRide } from '../../lib/types'
import { RideStatusBadge } from '../../components/Badge'
import { fcfa } from '../../lib/format'

const CANCELLABLE_STATUSES = ['requested', 'searching', 'accepted', 'driver_arriving', 'driver_arrived']

export function ActiveRideSection({
  activeRide,
  driverInfo,
  busy,
  onCancel,
  onReport,
}: {
  activeRide: PassengerActiveRide
  driverInfo: DriverPublicInfo | null
  busy: boolean
  onCancel: () => void
  onReport: (rideId: string) => void
}) {
  return (
    <section className="mb-6 rounded-2xl border border-navy-500 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Course en cours</h2>
        <RideStatusBadge status={activeRide.status} />
      </div>
      {driverInfo && (
        <p className="text-sm font-medium text-ink-800">
          {driverInfo.full_name || 'Chauffeur'}
          {driverInfo.rating_avg != null && ` — ★ ${driverInfo.rating_avg.toFixed(1)}`}
          {driverInfo.vehicle_brand && (
            <span className="block text-xs text-ink-500">
              {driverInfo.vehicle_brand} {driverInfo.vehicle_model} {driverInfo.vehicle_color} — {driverInfo.vehicle_plate}
            </span>
          )}
        </p>
      )}
      {!driverInfo && <p className="text-sm text-ink-400">Recherche d'un chauffeur…</p>}
      <p className="mt-2 text-sm text-ink-600">
        {activeRide.pickup_address} → {activeRide.dropoff_address}
      </p>
      <p className="mt-1 text-sm text-ink-600">
        {activeRide.estimated_fare_fcfa != null ? fcfa(activeRide.estimated_fare_fcfa) : '—'} —{' '}
        {activeRide.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}
      </p>
      {CANCELLABLE_STATUSES.includes(activeRide.status) && (
        <button
          disabled={busy}
          onClick={onCancel}
          className="mt-4 w-full rounded-lg bg-red-50 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
        >
          Annuler la course
        </button>
      )}
      <button
        onClick={() => onReport(activeRide.id)}
        className="mt-2 w-full rounded-lg border border-ink-100 py-2 text-xs font-medium text-ink-500 hover:bg-ink-50"
      >
        Signaler un problème
      </button>
    </section>
  )
}
