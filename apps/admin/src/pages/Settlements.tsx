import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import type { DriverForSettlement, SettlementListRow, SettlementStatus } from '../lib/types'
import { Badge, CategoryBadge } from '../components/Badge'
import { fcfa } from '../lib/format'

const STATUS_OPTIONS: { label: string; value: SettlementStatus | 'all' }[] = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'En attente', value: 'pending' },
  { label: 'Réglé', value: 'settled' },
]

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function Settlements() {
  const [status, setStatus] = useState<SettlementStatus | 'all'>('pending')
  const [settlements, setSettlements] = useState<SettlementListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [drivers, setDrivers] = useState<DriverForSettlement[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formDriverId, setFormDriverId] = useState('')
  const [formStart, setFormStart] = useState(() => toDateInput(new Date(Date.now() - 7 * 24 * 3600 * 1000)))
  const [formEnd, setFormEnd] = useState(() => toDateInput(new Date()))
  const [formError, setFormError] = useState<string | null>(null)
  const [formBusy, setFormBusy] = useState(false)

  const load = useCallback(() => {
    setSettlements(null)
    let query = supabase
      .from('settlements')
      .select(
        'id, period_start, period_end, rides_count, gross_transport_fcfa, platform_fees_fcfa, status, settlement_method, settled_at, drivers(category, profiles(phone, full_name))',
      )
      .order('period_start', { ascending: false })
      .limit(200)

    if (status !== 'all') query = query.eq('status', status)

    query.then(({ data, error }) => {
      if (error) setError(error.message)
      else setSettlements(data as unknown as SettlementListRow[])
    })
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    supabase
      .from('drivers')
      .select('id, category, profiles(phone, full_name)')
      .eq('status', 'approved')
      .then(({ data }) => setDrivers((data as unknown as DriverForSettlement[]) ?? []))
  }, [])

  async function markPaid(settlementId: string) {
    setActionError(null)
    const method = window.prompt('Méthode de règlement (ex : Flooz, virement, espèces) :')
    if (method === null) return
    if (!window.confirm('Confirmer que ce règlement a bien été payé au chauffeur ?')) return
    setBusyId(settlementId)
    const { error } = await supabase.rpc('admin_mark_settlement_paid', {
      _settlement_id: settlementId,
      _settlement_method: method || null,
    })
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  async function createSettlement(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!formDriverId) {
      setFormError('Sélectionnez un chauffeur.')
      return
    }
    const start = new Date(formStart)
    const end = new Date(formEnd)
    if (end <= start) {
      setFormError('La fin de période doit être après le début.')
      return
    }
    setFormBusy(true)
    const { error } = await supabase.rpc('admin_create_settlement', {
      _driver_id: formDriverId,
      _period_start: start.toISOString(),
      _period_end: end.toISOString(),
    })
    setFormBusy(false)
    if (error) {
      setFormError(error.message)
      return
    }
    setShowForm(false)
    setFormDriverId('')
    load()
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink-900">Règlements</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700"
        >
          {showForm ? 'Annuler' : 'Nouveau règlement'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createSettlement} className="mb-6 max-w-xl rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Générer un règlement</h2>

          <label className="mb-1 block text-sm font-medium text-ink-800">Chauffeur</label>
          <select
            value={formDriverId}
            onChange={(e) => setFormDriverId(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
          >
            <option value="">— Sélectionner —</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {(d.profiles?.full_name || d.profiles?.phone || d.id.slice(0, 8)) + (d.category === 'car' ? ' (Voiture)' : ' (Moto-taxi)')}
              </option>
            ))}
          </select>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Début de période</label>
              <input
                type="date"
                value={formStart}
                onChange={(e) => setFormStart(e.target.value)}
                className="w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-800">Fin de période</label>
              <input
                type="date"
                value={formEnd}
                onChange={(e) => setFormEnd(e.target.value)}
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
            {formBusy ? 'Génération…' : 'Générer'}
          </button>
          <p className="mt-2 text-xs text-ink-400">
            Regroupe toutes les courses réussies non encore réglées du chauffeur sur cette période.
          </p>
        </form>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as SettlementStatus | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {(error || actionError) && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error || actionError}
        </div>
      )}

      {!error && settlements === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && settlements !== null && settlements.length === 0 && (
        <p className="text-sm text-ink-400">Aucun règlement pour ces filtres.</p>
      )}

      {!error && settlements !== null && settlements.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Chauffeur</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Période</th>
                <th className="px-4 py-3">Courses</th>
                <th className="px-4 py-3">Brut transport</th>
                <th className="px-4 py-3">Frais de service</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Réglé le</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3 font-medium text-ink-800">
                    {s.drivers?.profiles?.full_name || s.drivers?.profiles?.phone || '—'}
                  </td>
                  <td className="px-4 py-3">{s.drivers && <CategoryBadge category={s.drivers.category} />}</td>
                  <td className="px-4 py-3 text-ink-600">
                    {new Date(s.period_start).toLocaleDateString('fr-FR')} → {new Date(s.period_end).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-ink-600">{s.rides_count}</td>
                  <td className="px-4 py-3 text-ink-600">{fcfa(s.gross_transport_fcfa)}</td>
                  <td className="px-4 py-3 font-medium text-ink-800">{fcfa(s.platform_fees_fcfa)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={s.status === 'settled' ? 'green' : 'gold'}>{s.status === 'settled' ? 'Réglé' : 'En attente'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {s.settled_at
                      ? `${new Date(s.settled_at).toLocaleDateString('fr-FR')}${s.settlement_method ? ` (${s.settlement_method})` : ''}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {s.status === 'pending' && (
                      <button
                        disabled={busyId === s.id}
                        onClick={() => markPaid(s.id)}
                        className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        Marquer payé
                      </button>
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
