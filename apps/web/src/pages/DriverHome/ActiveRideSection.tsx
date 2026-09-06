import type { ActiveRide, PassengerPublicInfo } from '../../lib/types'
import { RideStatusBadge } from '../../components/Badge'
import { fcfa } from '../../lib/format'

export function ActiveRideSection({
  activeRide,
  passengerInfo,
  busy,
  onAdvanceRide,
  onReport,
}: {
  activeRide: ActiveRide
  passengerInfo: PassengerPublicInfo | null
  busy: boolean
  onAdvanceRide: () => void
  onReport: (rideId: string) => void
}) {
  return (
    <section className="mb-6 rounded-2xl border border-navy-500 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">Course en cours</h2>
        <RideStatusBadge status={activeRide.status} />
      </div>
      <p className="text-sm font-medium text-ink-800">{passengerInfo?.full_name || 'Passager'}</p>
      <p className="mt-1 text-sm text-ink-600">
        {activeRide.pickup_address} → {activeRide.dropoff_address}
      </p>
      <p className="mt-1 text-sm text-ink-600">
        {activeRide.estimated_fare_fcfa != null ? fcfa(activeRide.estimated_fare_fcfa) : '—'} —{' '}
        {activeRide.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}
      </p>
      <button
        disabled={busy || activeRide.status === 'completed'}
        onClick={onAdvanceRide}
        className="mt-4 w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
      >
        {activeRide.status === 'accepted' || activeRide.status === 'driver_arriving'
          ? 'Signaler mon arrivée'
          : activeRide.status === 'driver_arrived'
            ? 'Démarrer la course'
            : 'Terminer la course'}
      </button>
      <button
        onClick={() => onReport(activeRide.id)}
        className="mt-2 w-full rounded-lg border border-ink-100 py-2 text-xs font-medium text-ink-500 hover:bg-ink-50"
      >
        Signaler un problème
      </button>
    </section>
  )
}
