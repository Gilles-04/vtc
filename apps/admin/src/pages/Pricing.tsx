import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { DriverCategory, PricingRule, Zone } from '../lib/types'
import { Badge, CategoryBadge } from '../components/Badge'
import { fcfa } from '../lib/format'

function currentRuleIds(rules: PricingRule[]): Set<string> {
  const now = Date.now()
  const seen = new Set<string>()
  const current = new Set<string>()
  for (const r of rules) {
    const key = `${r.category}:${r.zone_id ?? 'global'}`
    if (seen.has(key)) continue
    if (new Date(r.effective_from).getTime() <= now) {
      seen.add(key)
      current.add(r.id)
    }
  }
  return current
}

export function Pricing() {
  const [rules, setRules] = useState<PricingRule[] | null>(null)
  const [zones, setZones] = useState<Zone[]>([])
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [formCategory, setFormCategory] = useState<DriverCategory>('car')
  const [formZoneId, setFormZoneId] = useState('')
  const [formBaseFare, setFormBaseFare] = useState('300')
  const [formPerKm, setFormPerKm] = useState('150')
  const [formPerMin, setFormPerMin] = useState('20')
  const [formMinimum, setFormMinimum] = useState('500')
  const [formNightPercent, setFormNightPercent] = useState('0')
  const [formError, setFormError] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)

  const load = useCallback(() => {
    setRules(null)
    supabase
      .from('pricing_rules')
      .select(
        'id, category, zone_id, base_fare_fcfa, price_per_km_fcfa, price_per_min_fcfa, minimum_fare_fcfa, night_multiplier_percent, effective_from, zones(name, city)',
      )
      .order('category')
      .order('effective_from', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRules(data as unknown as PricingRule[])
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    supabase
      .from('zones')
      .select('id, name, city')
      .order('name')
      .then(({ data }) => setZones((data as Zone[]) ?? []))
  }, [])

  async function createRule(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const values = [formBaseFare, formPerKm, formPerMin, formMinimum, formNightPercent].map(Number)
    if (values.some((v) => !Number.isFinite(v) || v < 0)) {
      setFormError('Tous les montants doivent être des nombres positifs.')
      return
    }
    setFormBusy(true)
    const { error } = await supabase.from('pricing_rules').insert({
      category: formCategory,
      zone_id: formZoneId || null,
      base_fare_fcfa: Number(formBaseFare),
      price_per_km_fcfa: Number(formPerKm),
      price_per_min_fcfa: Number(formPerMin),
      minimum_fare_fcfa: Number(formMinimum),
      night_multiplier_percent: Number(formNightPercent),
    })
    setFormBusy(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setShowForm(false)
    load()
  }

  const current = rules ? currentRuleIds(rules) : new Set<string>()

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">Tarification</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
        >
          {showForm ? 'Annuler' : 'Nouvelle règle'}
        </button>
      </div>

      <p className="mb-4 max-w-2xl text-sm text-ink-400">
        Une nouvelle règle crée une nouvelle version, effective immédiatement — les règles ne se modifient jamais en
        place (historique conservé). La règle « Actuelle » est celle avec la date d'entrée en vigueur la plus récente
        et déjà passée, par catégorie et par zone (une règle sans zone sert de valeur par défaut).
      </p>

      {showForm && (
        <form onSubmit={createRule} className="mb-6 max-w-2xl rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Nouvelle règle de prix</h2>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Catégorie</label>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value as DriverCategory)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              >
                <option value="car">🚗 Voiture</option>
                <option value="moto">🏍️ Moto-taxi</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Zone (optionnel)</label>
              <select
                value={formZoneId}
                onChange={(e) => setFormZoneId(e.target.value)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              >
                <option value="">Toutes zones (par défaut)</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} ({z.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Prise en charge (FCFA)</label>
              <input
                type="number"
                value={formBaseFare}
                onChange={(e) => setFormBaseFare(e.target.value)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Prix / km (FCFA)</label>
              <input
                type="number"
                value={formPerKm}
                onChange={(e) => setFormPerKm(e.target.value)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Prix / min (FCFA)</label>
              <input
                type="number"
                value={formPerMin}
                onChange={(e) => setFormPerMin(e.target.value)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Course minimum (FCFA)</label>
              <input
                type="number"
                value={formMinimum}
                onChange={(e) => setFormMinimum(e.target.value)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Majoration nuit (%)</label>
              <input
                type="number"
                value={formNightPercent}
                onChange={(e) => setFormNightPercent(e.target.value)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
          </div>

          {formError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

          <button
            type="submit"
            disabled={formBusy}
            className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
          >
            {formBusy ? 'Création…' : 'Créer'}
          </button>
        </form>
      )}

      {error && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!error && rules === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && rules !== null && rules.length === 0 && (
        <p className="text-sm text-ink-400">Aucune règle de prix configurée — la demande de course échouera tant qu'aucune règle n'existe pour une catégorie.</p>
      )}

      {!error && rules !== null && rules.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Prise en charge</th>
                <th className="px-4 py-3">Prix / km</th>
                <th className="px-4 py-3">Prix / min</th>
                <th className="px-4 py-3">Minimum</th>
                <th className="px-4 py-3">Nuit</th>
                <th className="px-4 py-3">Effective depuis</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <CategoryBadge category={r.category} />
                  </td>
                  <td className="px-4 py-3 text-ink-600">{r.zones ? `${r.zones.name} (${r.zones.city})` : 'Toutes zones'}</td>
                  <td className="px-4 py-3 text-ink-600">{fcfa(r.base_fare_fcfa)}</td>
                  <td className="px-4 py-3 text-ink-600">{fcfa(r.price_per_km_fcfa)}</td>
                  <td className="px-4 py-3 text-ink-600">{fcfa(r.price_per_min_fcfa)}</td>
                  <td className="px-4 py-3 text-ink-600">{fcfa(r.minimum_fare_fcfa)}</td>
                  <td className="px-4 py-3 text-ink-600">{r.night_multiplier_percent > 0 ? `+${r.night_multiplier_percent}%` : '—'}</td>
                  <td className="px-4 py-3 text-ink-600">{new Date(r.effective_from).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3">
                    {current.has(r.id) ? <Badge tone="green">Actuelle</Badge> : <Badge tone="default">Historique</Badge>}
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
