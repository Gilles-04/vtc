import { useCallback, useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { SubscriptionPlan } from '../lib/types'
import { CategoryBadge, Badge } from '../components/Badge'
import { fcfa } from '../lib/format'

export function SubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setPlans(null)
    supabase
      .from('subscription_plans')
      .select('id, code, name, category, duration_hours, price_fcfa, is_active, sort_order')
      .order('category')
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setPlans(data as SubscriptionPlan[])
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function toggleActive(plan: SubscriptionPlan) {
    setActionError(null)
    if (!plan.is_active && plan.price_fcfa == null) {
      setActionError('Ce plan n’a pas de prix — renseignez-en un avant de l’activer.')
      return
    }
    setBusyId(plan.id)
    const { error } = await supabase.from('subscription_plans').update({ is_active: !plan.is_active }).eq('id', plan.id)
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  async function editPrice(plan: SubscriptionPlan) {
    setActionError(null)
    const input = window.prompt(`Nouveau prix pour « ${plan.name} » (FCFA) :`, plan.price_fcfa != null ? String(plan.price_fcfa) : '')
    if (input === null) return
    const price = Number(input)
    if (!Number.isInteger(price) || price <= 0) {
      setActionError('Prix invalide — entrez un nombre entier positif.')
      return
    }
    setBusyId(plan.id)
    const { error } = await supabase.from('subscription_plans').update({ price_fcfa: price }).eq('id', plan.id)
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Plans d'abonnement</h1>
          <Link to="/abonnements" className="text-sm font-medium text-navy-700 hover:underline">
            ← Retour aux abonnements
          </Link>
        </div>
      </div>

      {(error || actionError) && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error || actionError}
        </div>
      )}

      {!error && plans === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && plans !== null && (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Durée</th>
                <th className="px-4 py-3">Prix</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3 font-medium text-ink-800">{p.name}</td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={p.category} />
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {p.duration_hours < 24 ? `${p.duration_hours} h` : `${Math.round(p.duration_hours / 24)} j`}
                  </td>
                  <td className="px-4 py-3 text-ink-600">{p.price_fcfa != null ? fcfa(p.price_fcfa) : '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.is_active ? 'green' : 'default'}>{p.is_active ? 'Actif' : 'Inactif'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        disabled={busyId === p.id}
                        onClick={() => editPrice(p)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100 disabled:opacity-50"
                      >
                        Modifier le prix
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => toggleActive(p)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                          p.is_active ? 'text-red-700 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'
                        }`}
                      >
                        {p.is_active ? 'Désactiver' : 'Activer'}
                      </button>
                    </div>
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
