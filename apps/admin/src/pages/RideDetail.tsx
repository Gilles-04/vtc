import { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { RideListRow, RideStatus } from '../lib/types'
import { CategoryBadge, PaymentStatusBadge, RideStatusBadge } from '../components/Badge'
import { fcfa } from '../lib/format'

interface StatusHistoryRow {
  id: string
  from_status: RideStatus | null
  to_status: RideStatus
  changed_at: string
}

const STATUS_LABEL: Record<RideStatus, string> = {
  requested: 'Demandée',
  searching: 'Recherche chauffeur',
  accepted: 'Acceptée',
  driver_arriving: 'Chauffeur en route',
  driver_arrived: 'Chauffeur arrivé',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled_by_passenger: 'Annulée (passager)',
  cancelled_by_driver: 'Annulée (chauffeur)',
  cancelled_by_system: 'Annulée (système)',
}

export function RideDetail() {
  const { rideId } = useParams({ from: '/courses/$rideId' })
  const [ride, setRide] = useState<RideListRow | null>(null)
  const [history, setHistory] = useState<StatusHistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('rides')
      .select(
        'id, category, status, pickup_address, dropoff_address, estimated_fare_fcfa, final_fare_fcfa, payment_method, payment_status, zone_id, requested_at, completed_at, profiles!passenger_id(phone, full_name), drivers(profiles(phone, full_name))',
      )
      .eq('id', rideId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRide(data as unknown as RideListRow)
      })

    supabase
      .from('ride_status_history')
      .select('id, from_status, to_status, changed_at')
      .eq('ride_id', rideId)
      .order('changed_at')
      .then(({ data }) => setHistory((data as StatusHistoryRow[]) ?? []))
  }, [rideId])

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    )
  }

  if (!ride) {
    return <p className="p-8 text-sm text-ink-400">Chargement…</p>
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Course {ride.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-ink-600">
            {ride.profiles?.full_name || ride.profiles?.phone || '—'}
            {' → '}
            {ride.drivers?.profiles?.full_name || ride.drivers?.profiles?.phone || 'Aucun chauffeur assigné'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CategoryBadge category={ride.category} />
          <RideStatusBadge status={ride.status} />
        </div>
      </div>

      <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Trajet</h2>
        <p className="text-sm text-ink-800">
          <span className="font-medium">Départ :</span> {ride.pickup_address}
        </p>
        <p className="mt-1 text-sm text-ink-800">
          <span className="font-medium">Arrivée :</span> {ride.dropoff_address}
        </p>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard label="Estimé" value={ride.estimated_fare_fcfa != null ? fcfa(ride.estimated_fare_fcfa) : '—'} />
        <InfoCard label="Prix final" value={ride.final_fare_fcfa != null ? fcfa(ride.final_fare_fcfa) : '—'} />
        <InfoCard label="Mode de paiement" value={ride.payment_method === 'cash' ? 'Cash' : 'Mobile Money'} />
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-ink-400">Statut paiement</p>
          <div className="mt-1">
            <PaymentStatusBadge status={ride.payment_status} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Chronologie</h2>
        {!history && <p className="text-sm text-ink-400">Chargement…</p>}
        {history && history.length === 0 && <p className="text-sm text-ink-400">Aucun historique.</p>}
        {history && history.length > 0 && (
          <ol className="space-y-2">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-800">{STATUS_LABEL[h.to_status] ?? h.to_status}</span>
                <span className="text-ink-400">{new Date(h.changed_at).toLocaleString('fr-FR')}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  )
}
