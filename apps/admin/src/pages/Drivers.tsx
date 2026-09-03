import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { DriverListRow, DriverStatus } from '../lib/types'
import { DriverStatusBadge, CategoryBadge } from '../components/Badge'

const FILTERS: { label: string; value: DriverStatus | 'all' }[] = [
  { label: 'En attente de revue', value: 'pending_review' },
  { label: 'Tous', value: 'all' },
  { label: 'Approuvés', value: 'approved' },
  { label: 'Rejetés', value: 'rejected' },
  { label: 'Suspendus', value: 'suspended' },
]

export function Drivers() {
  const [filter, setFilter] = useState<DriverStatus | 'all'>('pending_review')
  const [drivers, setDrivers] = useState<DriverListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setDrivers(null)
    let query = supabase
      .from('drivers')
      .select('id, category, status, city, rating_avg, rating_count, total_rides, created_at, profiles(phone, full_name)')
      .order('created_at', { ascending: false })
    if (filter !== 'all') query = query.eq('status', filter)

    query.then(({ data, error }) => {
      if (cancelled) return
      if (error) setError(error.message)
      else setDrivers(data as unknown as DriverListRow[])
    })
    return () => {
      cancelled = true
    }
  }, [filter])

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-ink-900">Chauffeurs</h1>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              filter === f.value ? 'bg-navy-700 text-white' : 'bg-white text-ink-600 hover:bg-ink-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!error && drivers === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && drivers !== null && drivers.length === 0 && (
        <p className="text-sm text-ink-400">Aucun chauffeur dans cette catégorie.</p>
      )}

      {!error && drivers !== null && drivers.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Chauffeur</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Courses</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <Link to="/chauffeurs/$driverId" params={{ driverId: d.id }} className="font-medium text-navy-700 hover:underline">
                      {d.profiles?.full_name || d.profiles?.phone || d.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={d.category} />
                  </td>
                  <td className="px-4 py-3">
                    <DriverStatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-600">{d.city || '—'}</td>
                  <td className="px-4 py-3 text-ink-600">
                    {d.rating_count > 0 ? `${d.rating_avg.toFixed(1)} (${d.rating_count})` : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-600">{d.total_rides}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
