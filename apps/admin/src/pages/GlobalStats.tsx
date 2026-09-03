import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { StatCard } from '../components/StatCard'
import { fcfa } from '../lib/format'

const PERIOD_OPTIONS: { label: string; value: 7 | 30 | 90 }[] = [
  { label: '7 derniers jours', value: 7 },
  { label: '30 derniers jours', value: 30 },
  { label: '90 derniers jours', value: 90 },
]

interface DayRevenue {
  date: string
  platformFeesFcfa: number
  subscriptionFcfa: number
}

interface RetentionRow {
  category: 'car' | 'moto'
  approvedCount: number
  activeSubscriptionCount: number
}

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

export function GlobalStats() {
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30)
  const [revenue, setRevenue] = useState<DayRevenue[] | null>(null)
  const [retention, setRetention] = useState<RetentionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRevenue(null)
    setError(null)
    const since = new Date(Date.now() - periodDays * 24 * 3600 * 1000).toISOString()

    Promise.all([
      supabase.from('invoices').select('issued_at, platform_fee_fcfa').gte('issued_at', since),
      supabase
        .from('payments')
        .select('created_at, amount_fcfa')
        .eq('purpose', 'driver_subscription')
        .eq('status', 'success')
        .gte('created_at', since),
    ]).then(([invoicesRes, paymentsRes]) => {
      if (invoicesRes.error) {
        setError(invoicesRes.error.message)
        return
      }
      if (paymentsRes.error) {
        setError(paymentsRes.error.message)
        return
      }

      const byDay = new Map<string, DayRevenue>()
      for (const inv of invoicesRes.data ?? []) {
        const key = dateKey(inv.issued_at)
        const row = byDay.get(key) ?? { date: key, platformFeesFcfa: 0, subscriptionFcfa: 0 }
        row.platformFeesFcfa += inv.platform_fee_fcfa
        byDay.set(key, row)
      }
      for (const pay of paymentsRes.data ?? []) {
        const key = dateKey(pay.created_at)
        const row = byDay.get(key) ?? { date: key, platformFeesFcfa: 0, subscriptionFcfa: 0 }
        row.subscriptionFcfa += pay.amount_fcfa
        byDay.set(key, row)
      }
      setRevenue([...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)))
    })
  }, [periodDays])

  useEffect(() => {
    setRetention(null)
    Promise.all([
      supabase.from('drivers').select('category').eq('status', 'approved'),
      supabase.from('subscriptions').select('driver_id, drivers!inner(category)').eq('status', 'active'),
    ]).then(([driversRes, subsRes]) => {
      if (driversRes.error || subsRes.error) {
        setError(driversRes.error?.message || subsRes.error?.message || 'Erreur inconnue')
        return
      }
      const approvedByCategory: Record<string, number> = { car: 0, moto: 0 }
      for (const d of driversRes.data ?? []) approvedByCategory[d.category] = (approvedByCategory[d.category] ?? 0) + 1

      const activeDrivers = new Set<string>()
      const activeByCategory: Record<string, Set<string>> = { car: new Set(), moto: new Set() }
      for (const s of (subsRes.data as unknown as { driver_id: string; drivers: { category: 'car' | 'moto' } }[]) ?? []) {
        if (!activeDrivers.has(s.driver_id)) {
          activeDrivers.add(s.driver_id)
          activeByCategory[s.drivers.category]?.add(s.driver_id)
        }
      }

      setRetention([
        { category: 'car', approvedCount: approvedByCategory.car ?? 0, activeSubscriptionCount: activeByCategory.car.size },
        { category: 'moto', approvedCount: approvedByCategory.moto ?? 0, activeSubscriptionCount: activeByCategory.moto.size },
      ])
    })
  }, [])

  const totalPlatformFees = revenue?.reduce((sum, r) => sum + r.platformFeesFcfa, 0) ?? 0
  const totalSubscriptions = revenue?.reduce((sum, r) => sum + r.subscriptionFcfa, 0) ?? 0

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">Statistiques globales</h1>
        <select
          value={periodDays}
          onChange={(e) => setPeriodDays(Number(e.target.value) as 7 | 30 | 90)}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Revenus sur la période — abonnement et frais de service, jamais fusionnés
        </h2>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Frais de service" value={fcfa(totalPlatformFees)} tone="gold" />
          <StatCard label="Abonnements" value={fcfa(totalSubscriptions)} tone="navy" />
          <StatCard label="Total" value={fcfa(totalPlatformFees + totalSubscriptions)} />
        </div>

        {revenue === null && <p className="text-sm text-ink-400">Chargement…</p>}
        {revenue !== null && revenue.length === 0 && (
          <p className="text-sm text-ink-400">Aucune donnée de revenu sur cette période.</p>
        )}
        {revenue !== null && revenue.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3">Jour</th>
                  <th className="px-4 py-3">Frais de service</th>
                  <th className="px-4 py-3">Abonnements</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.date} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                    <td className="px-4 py-3 text-ink-800">{new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="px-4 py-3 text-ink-600">{fcfa(r.platformFeesFcfa)}</td>
                    <td className="px-4 py-3 text-ink-600">{fcfa(r.subscriptionFcfa)}</td>
                    <td className="px-4 py-3 font-medium text-ink-800">{fcfa(r.platformFeesFcfa + r.subscriptionFcfa)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Rétention chauffeurs — abonnement actif parmi les chauffeurs approuvés
        </h2>
        {retention === null && <p className="text-sm text-ink-400">Chargement…</p>}
        {retention !== null && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {retention.map((r) => {
              const percent = r.approvedCount > 0 ? Math.round((r.activeSubscriptionCount / r.approvedCount) * 100) : 0
              return (
                <StatCard
                  key={r.category}
                  label={r.category === 'car' ? 'Voiture' : 'Moto-taxi'}
                  value={`${percent}% (${r.activeSubscriptionCount}/${r.approvedCount})`}
                  tone={percent >= 50 ? 'navy' : 'gold'}
                />
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
