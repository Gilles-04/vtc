import type { RideHistoryRow, RideInvoice } from '../../lib/types'
import { CategoryBadge, RideStatusBadge } from '../../components/Badge'
import { fcfa } from '../../lib/format'

export function EarningsSection({
  earnings,
  rideHistory,
  rideInvoicesByRide,
  onDownloadInvoice,
  onReport,
}: {
  earnings: { today: number; week: number; month: number }
  rideHistory: RideHistoryRow[]
  rideInvoicesByRide: Record<string, RideInvoice>
  onDownloadInvoice: (ride: RideHistoryRow) => void
  onReport: (rideId: string) => void
}) {
  return (
    <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Revenus</h2>
      <p className="mb-3 text-xs text-ink-400">Gains transport, net des frais de service — jamais mélangé à l'abonnement.</p>
      <div className="mb-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-ink-100 p-3 text-center">
          <p className="text-xs text-ink-400">Aujourd'hui</p>
          <p className="text-sm font-semibold text-ink-800">{fcfa(earnings.today)}</p>
        </div>
        <div className="rounded-xl border border-ink-100 p-3 text-center">
          <p className="text-xs text-ink-400">7 derniers jours</p>
          <p className="text-sm font-semibold text-ink-800">{fcfa(earnings.week)}</p>
        </div>
        <div className="rounded-xl border border-ink-100 p-3 text-center">
          <p className="text-xs text-ink-400">Ce mois-ci</p>
          <p className="text-sm font-semibold text-ink-800">{fcfa(earnings.month)}</p>
        </div>
      </div>

      {rideHistory.length > 0 ? (
        <div className="space-y-2">
          {rideHistory.map((r) => (
            <div key={r.id} className="rounded-xl border border-ink-100 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <CategoryBadge category={r.category} />
                <RideStatusBadge status={r.status} />
              </div>
              <p className="text-sm text-ink-600">
                {r.pickup_address} → {r.dropoff_address}
              </p>
              <div className="mt-1 flex items-center justify-between text-xs text-ink-400">
                <span>{new Date(r.requested_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                <span>{(r.final_fare_fcfa ?? r.estimated_fare_fcfa) != null ? fcfa((r.final_fare_fcfa ?? r.estimated_fare_fcfa) as number) : '—'}</span>
              </div>
              <div className="mt-2 flex gap-2">
                {rideInvoicesByRide[r.id] && (
                  <button
                    onClick={() => onDownloadInvoice(r)}
                    className="rounded-lg border border-ink-200 px-3 py-1 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  >
                    Facture
                  </button>
                )}
                <button
                  onClick={() => onReport(r.id)}
                  className="rounded-lg border border-ink-200 px-3 py-1 text-xs font-medium text-ink-500 hover:bg-ink-50"
                >
                  Signaler
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-400">Aucune course dans votre historique pour le moment.</p>
      )}
    </section>
  )
}
