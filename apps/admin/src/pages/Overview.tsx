import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AdminStatsOverview } from '../lib/types'
import { StatCard } from '../components/StatCard'
import { fcfa } from '../lib/format'

export function Overview() {
  const [stats, setStats] = useState<AdminStatsOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('admin_stats_overview')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(
            error.message.includes('not_authorized')
              ? "Ce compte n'a pas de rôle admin (table admin_roles) — voir docs/STATUS.md."
              : error.message,
          )
        } else {
          setStats(data as AdminStatsOverview)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p className="p-8 text-sm text-ink-400">Chargement…</p>
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Impossible de charger les statistiques</p>
          <p className="mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-ink-900">Vue d'ensemble</h1>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Courses</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Courses aujourd'hui" value={stats.rides_today} />
          <StatCard label="dont voiture" value={stats.rides_today_car} />
          <StatCard label="dont moto-taxi" value={stats.rides_today_moto} />
          <StatCard label="Terminées" value={stats.rides_completed_today} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Chauffeurs & abonnements
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Actifs — voiture" value={stats.active_drivers_car} tone="emerald" />
          <StatCard label="Actifs — moto" value={stats.active_drivers_moto} tone="emerald" />
          <StatCard label="Approuvés — voiture" value={stats.approved_drivers_car} />
          <StatCard label="Approuvés — moto" value={stats.approved_drivers_moto} />
          <StatCard label="KYC en attente" value={stats.pending_kyc} tone={stats.pending_kyc > 0 ? 'gold' : 'default'} />
          <StatCard label="Abonnements actifs — voiture" value={stats.active_subscriptions_car} />
          <StatCard label="Abonnements actifs — moto" value={stats.active_subscriptions_moto} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Revenus du jour — abonnement et frais de service, jamais fusionnés
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Abonnement — voiture" value={fcfa(stats.subscription_revenue_today_car_fcfa)} tone="emerald" />
          <StatCard label="Abonnement — moto" value={fcfa(stats.subscription_revenue_today_moto_fcfa)} tone="emerald" />
          <StatCard label="Frais de service — voiture" value={fcfa(stats.platform_fees_today_car_fcfa)} tone="gold" />
          <StatCard label="Frais de service — moto" value={fcfa(stats.platform_fees_today_moto_fcfa)} tone="gold" />
          <StatCard label="Frais en attente de règlement" value={fcfa(stats.platform_fees_pending_settlement_fcfa)} />
          <StatCard label="Volume de courses" value={fcfa(stats.rides_volume_today_fcfa)} />
          <StatCard label="Net chauffeurs" value={fcfa(stats.driver_earnings_today_fcfa)} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Paiements</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Cash" value={`${stats.payments_cash_today_count} · ${fcfa(stats.payments_cash_today_fcfa)}`} />
          <StatCard
            label="Mobile Money"
            value={`${stats.payments_mobile_money_today_count} · ${fcfa(stats.payments_mobile_money_today_fcfa)}`}
          />
          <StatCard label="Échoués" value={stats.payments_failed_today_count} tone={stats.payments_failed_today_count > 0 ? 'red' : 'default'} />
          <StatCard label="Remboursements" value={`${stats.refunds_today_count} · ${fcfa(stats.refunds_today_fcfa)}`} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Alertes</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="SOS ouverts" value={stats.open_sos} tone={stats.open_sos > 0 ? 'red' : 'default'} />
          <StatCard label="Signalements ouverts" value={stats.open_reports} />
          <StatCard label="Tickets support ouverts" value={stats.open_support_tickets} />
          <StatCard label="Signalements fraude" value={stats.open_fraud_flags} />
        </div>
      </section>
    </div>
  )
}
