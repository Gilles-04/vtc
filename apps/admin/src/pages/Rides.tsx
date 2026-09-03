import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { DriverCategory, RideListRow, RideStatus, Zone } from '../lib/types'
import { CategoryBadge, PaymentStatusBadge, RideStatusBadge } from '../components/Badge'
import { fcfa } from '../lib/format'

const STATUS_OPTIONS: { label: string; value: RideStatus | 'all' }[] = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'Demandée', value: 'requested' },
  { label: 'Recherche chauffeur', value: 'searching' },
  { label: 'Acceptée', value: 'accepted' },
  { label: 'Chauffeur en route', value: 'driver_arriving' },
  { label: 'Chauffeur arrivé', value: 'driver_arrived' },
  { label: 'En cours', value: 'in_progress' },
  { label: 'Terminée', value: 'completed' },
  { label: 'Annulée (passager)', value: 'cancelled_by_passenger' },
  { label: 'Annulée (chauffeur)', value: 'cancelled_by_driver' },
  { label: 'Annulée (système)', value: 'cancelled_by_system' },
]

const CATEGORY_OPTIONS: { label: string; value: DriverCategory | 'all' }[] = [
  { label: 'Toutes catégories', value: 'all' },
  { label: '🚗 Voiture', value: 'car' },
  { label: '🏍️ Moto-taxi', value: 'moto' },
]

const PERIOD_OPTIONS: { label: string; value: 'today' | '7d' | '30d' | 'all' }[] = [
  { label: "Aujourd'hui", value: 'today' },
  { label: '7 derniers jours', value: '7d' },
  { label: '30 derniers jours', value: '30d' },
  { label: 'Tout', value: 'all' },
]

function periodStart(period: 'today' | '7d' | '30d' | 'all'): string | null {
  const now = new Date()
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  }
  if (period === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
  if (period === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
  return null
}

export function Rides() {
  const [status, setStatus] = useState<RideStatus | 'all'>('all')
  const [category, setCategory] = useState<DriverCategory | 'all'>('all')
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('today')
  const [zoneId, setZoneId] = useState<string | 'all'>('all')
  const [zones, setZones] = useState<Zone[]>([])
  const [rides, setRides] = useState<RideListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('zones')
      .select('id, name, city')
      .order('name')
      .then(({ data }) => setZones((data as Zone[]) ?? []))
  }, [])

  useEffect(() => {
    setRides(null)
    let query = supabase
      .from('rides')
      .select(
        'id, category, status, pickup_address, dropoff_address, estimated_fare_fcfa, final_fare_fcfa, payment_method, payment_status, zone_id, requested_at, completed_at, profiles!passenger_id(phone, full_name), drivers(profiles(phone, full_name))',
      )
      .order('requested_at', { ascending: false })
      .limit(200)

    if (status !== 'all') query = query.eq('status', status)
    if (category !== 'all') query = query.eq('category', category)
    if (zoneId !== 'all') query = query.eq('zone_id', zoneId)
    const start = periodStart(period)
    if (start) query = query.gte('requested_at', start)

    query.then(({ data, error }) => {
      if (error) setError(error.message)
      else setRides(data as unknown as RideListRow[])
    })
  }, [status, category, period, zoneId])

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-ink-900">Courses</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RideStatus | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DriverCategory | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'today' | '7d' | '30d' | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {zones.length > 0 && (
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
          >
            <option value="all">Toutes zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name} ({z.city})
              </option>
            ))}
          </select>
        )}
      </div>

      {error && (
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!error && rides === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && rides !== null && rides.length === 0 && (
        <p className="text-sm text-ink-400">Aucune course pour ces filtres.</p>
      )}

      {!error && rides !== null && rides.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Passager</th>
                <th className="px-4 py-3">Chauffeur</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Trajet</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Paiement</th>
                <th className="px-4 py-3">Demandée le</th>
              </tr>
            </thead>
            <tbody>
              {rides.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <Link to="/courses/$rideId" params={{ rideId: r.id }} className="font-medium text-navy-700 hover:underline">
                      {r.profiles?.full_name || r.profiles?.phone || r.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {r.drivers?.profiles?.full_name || r.drivers?.profiles?.phone || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={r.category} />
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    <span className="block max-w-[220px] truncate" title={`${r.pickup_address} → ${r.dropoff_address}`}>
                      {r.pickup_address} → {r.dropoff_address}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <RideStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {r.final_fare_fcfa != null ? fcfa(r.final_fare_fcfa) : r.estimated_fare_fcfa != null ? `~${fcfa(r.estimated_fare_fcfa)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-ink-600">{r.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}</span>
                      <PaymentStatusBadge status={r.payment_status} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {new Date(r.requested_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
