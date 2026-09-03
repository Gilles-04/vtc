import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { VehicleListRow } from '../lib/types'
import { CategoryBadge } from '../components/Badge'

export function Vehicles() {
  const [search, setSearch] = useState('')
  const [vehicles, setVehicles] = useState<VehicleListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setVehicles(null)
    let query = supabase
      .from('vehicles')
      .select('id, brand, model, color, plate_number, year, drivers(id, category, profiles(phone, full_name))')
      .order('plate_number')
      .limit(200)

    if (search.trim()) query = query.ilike('plate_number', `%${search.trim()}%`)

    const timeout = setTimeout(() => {
      query.then(({ data, error }) => {
        if (error) setError(error.message)
        else setVehicles(data as unknown as VehicleListRow[])
      })
    }, 300)

    return () => clearTimeout(timeout)
  }, [search])

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-ink-900">Véhicules</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par plaque…"
          className="w-64 rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800 outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
        />
      </div>

      {error && (
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!error && vehicles === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && vehicles !== null && vehicles.length === 0 && (
        <p className="text-sm text-ink-400">Aucun véhicule pour cette recherche.</p>
      )}

      {!error && vehicles !== null && vehicles.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Plaque</th>
                <th className="px-4 py-3">Véhicule</th>
                <th className="px-4 py-3">Couleur</th>
                <th className="px-4 py-3">Année</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Chauffeur</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3 font-mono font-medium text-ink-800">{v.plate_number}</td>
                  <td className="px-4 py-3 text-ink-600">
                    {v.brand} {v.model}
                  </td>
                  <td className="px-4 py-3 text-ink-600">{v.color}</td>
                  <td className="px-4 py-3 text-ink-600">{v.year ?? '—'}</td>
                  <td className="px-4 py-3">{v.drivers && <CategoryBadge category={v.drivers.category} />}</td>
                  <td className="px-4 py-3">
                    {v.drivers ? (
                      <Link to="/chauffeurs/$driverId" params={{ driverId: v.drivers.id }} className="font-medium text-navy-700 hover:underline">
                        {v.drivers.profiles?.full_name || v.drivers.profiles?.phone || v.drivers.id.slice(0, 8)}
                      </Link>
                    ) : (
                      '—'
                    )}
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
