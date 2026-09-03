import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { DriverCategory, SubscriptionListRow, SubscriptionStatus } from '../lib/types'
import { CategoryBadge, SubscriptionStatusBadge } from '../components/Badge'
import { fcfa } from '../lib/format'

const STATUS_OPTIONS: { label: string; value: SubscriptionStatus | 'all' }[] = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'Actif', value: 'active' },
  { label: 'Expiré', value: 'expired' },
  { label: 'Annulé', value: 'cancelled' },
]

const CATEGORY_OPTIONS: { label: string; value: DriverCategory | 'all' }[] = [
  { label: 'Toutes catégories', value: 'all' },
  { label: '🚗 Voiture', value: 'car' },
  { label: '🏍️ Moto-taxi', value: 'moto' },
]

export function Subscriptions() {
  const [status, setStatus] = useState<SubscriptionStatus | 'all'>('active')
  const [category, setCategory] = useState<DriverCategory | 'all'>('all')
  const [subscriptions, setSubscriptions] = useState<SubscriptionListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSubscriptions(null)
    const driversEmbed = category === 'all' ? 'drivers' : 'drivers!inner'
    let query = supabase
      .from('subscriptions')
      .select(`id, status, started_at, expires_at, ${driversEmbed}(category, profiles(phone, full_name)), subscription_plans(name, duration_hours, price_fcfa)`)
      .order('started_at', { ascending: false })
      .limit(200)

    if (status !== 'all') query = query.eq('status', status)
    if (category !== 'all') query = query.eq('drivers.category', category)

    query.then(({ data, error }) => {
      if (error) setError(error.message)
      else setSubscriptions(data as unknown as SubscriptionListRow[])
    })
  }, [status, category])

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">Abonnements</h1>
        <Link to="/abonnements/plans" className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100">
          Gérer les plans →
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SubscriptionStatus | 'all')}
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
      </div>

      {error && (
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!error && subscriptions === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && subscriptions !== null && subscriptions.length === 0 && (
        <p className="text-sm text-ink-400">Aucun abonnement pour ces filtres.</p>
      )}

      {!error && subscriptions !== null && subscriptions.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Chauffeur</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Prix</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Début</th>
                <th className="px-4 py-3">Expire le</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3 font-medium text-ink-800">
                    {s.drivers?.profiles?.full_name || s.drivers?.profiles?.phone || '—'}
                  </td>
                  <td className="px-4 py-3">{s.drivers && <CategoryBadge category={s.drivers.category} />}</td>
                  <td className="px-4 py-3 text-ink-600">{s.subscription_plans?.name || '—'}</td>
                  <td className="px-4 py-3 text-ink-600">
                    {s.subscription_plans?.price_fcfa != null ? fcfa(s.subscription_plans.price_fcfa) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <SubscriptionStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {new Date(s.started_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {new Date(s.expires_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
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
