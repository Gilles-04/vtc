import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { PaymentListRow, PaymentProvider, PaymentPurpose, PaymentStatus } from '../lib/types'
import { PaymentPurposeBadge, PaymentStatusBadge, paymentProviderName } from '../components/Badge'
import { fcfa } from '../lib/format'

const STATUS_OPTIONS: { label: string; value: PaymentStatus | 'all' }[] = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'En attente', value: 'pending' },
  { label: 'En cours', value: 'processing' },
  { label: 'Réussi', value: 'success' },
  { label: 'Échoué', value: 'failed' },
  { label: 'Annulé', value: 'cancelled' },
  { label: 'Remboursé', value: 'refunded' },
]

const PURPOSE_OPTIONS: { label: string; value: PaymentPurpose | 'all' }[] = [
  { label: 'Tous les types', value: 'all' },
  { label: 'Abonnement chauffeur', value: 'driver_subscription' },
  { label: 'Course', value: 'ride_fare' },
]

const PROVIDER_OPTIONS: { label: string; value: PaymentProvider | 'all' }[] = [
  { label: 'Tous les fournisseurs', value: 'all' },
  { label: 'Flooz', value: 'flooz' },
  { label: 'T-Money', value: 'tmoney' },
  { label: 'Manuel', value: 'manual' },
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

export function Payments() {
  const [status, setStatus] = useState<PaymentStatus | 'all'>('all')
  const [purpose, setPurpose] = useState<PaymentPurpose | 'all'>('all')
  const [provider, setProvider] = useState<PaymentProvider | 'all'>('all')
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('7d')
  const [payments, setPayments] = useState<PaymentListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setPayments(null)
    let query = supabase
      .from('payments')
      .select('id, user_id, purpose, amount_fcfa, provider, provider_ref, status, created_at, confirmed_at, ride_id, profiles(phone, full_name)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (status !== 'all') query = query.eq('status', status)
    if (purpose !== 'all') query = query.eq('purpose', purpose)
    if (provider !== 'all') query = query.eq('provider', provider)
    const start = periodStart(period)
    if (start) query = query.gte('created_at', start)

    query.then(({ data, error }) => {
      if (error) setError(error.message)
      else setPayments(data as unknown as PaymentListRow[])
    })
  }, [status, purpose, provider, period])

  useEffect(() => {
    load()
  }, [load])

  async function confirmPayment(paymentId: string) {
    setActionError(null)
    if (!window.confirm("Confirmer la réception de ce paiement d'abonnement ?")) return
    setBusyId(paymentId)
    const { error } = await supabase.rpc('admin_manual_payment_confirm', { _payment_id: paymentId })
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  async function markFailed(paymentId: string) {
    setActionError(null)
    const reason = window.prompt('Raison de l\'échec (optionnel) :')
    if (reason === null) return
    setBusyId(paymentId)
    const { error } = await supabase.rpc('admin_mark_payment_failed', { _payment_id: paymentId, _reason: reason || null })
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  async function refundPayment(paymentId: string) {
    setActionError(null)
    const reason = window.prompt('Raison du remboursement (optionnel) :')
    if (reason === null) return
    if (!window.confirm('Confirmer le remboursement de ce paiement ?')) return
    setBusyId(paymentId)
    const { error } = await supabase.rpc('admin_refund_payment', { _payment_id: paymentId, _reason: reason || null })
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  const total = payments?.reduce((sum, p) => (p.status === 'success' ? sum + p.amount_fcfa : sum), 0) ?? 0

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-ink-900">Paiements</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as PaymentStatus | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value as PaymentPurpose | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {PURPOSE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as PaymentProvider | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {PROVIDER_OPTIONS.map((o) => (
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
      </div>

      {(error || actionError) && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error || actionError}
        </div>
      )}

      {!error && payments === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && payments !== null && payments.length === 0 && (
        <p className="text-sm text-ink-400">Aucun paiement pour ces filtres.</p>
      )}

      {!error && payments !== null && payments.length > 0 && (
        <>
          <p className="mb-3 text-sm text-ink-600">
            {payments.length} paiement{payments.length > 1 ? 's' : ''} — {fcfa(total)} réussis sur la période affichée
          </p>
          <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3">Fournisseur</th>
                  <th className="px-4 py-3">Référence</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Créé le</th>
                  <th className="px-4 py-3">Confirmé le</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-800">
                      {p.profiles?.full_name || p.profiles?.phone || p.user_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <PaymentPurposeBadge purpose={p.purpose} />
                    </td>
                    <td className="px-4 py-3 text-ink-600">{fcfa(p.amount_fcfa)}</td>
                    <td className="px-4 py-3 text-ink-600">{paymentProviderName(p.provider)}</td>
                    <td className="px-4 py-3 text-ink-400">{p.provider_ref || '—'}</td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {new Date(p.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {p.confirmed_at
                        ? new Date(p.confirmed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {p.status === 'pending' && p.purpose === 'driver_subscription' && (
                          <button
                            disabled={busyId === p.id}
                            onClick={() => confirmPayment(p.id)}
                            className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            Confirmer
                          </button>
                        )}
                        {p.status === 'pending' && (
                          <button
                            disabled={busyId === p.id}
                            onClick={() => markFailed(p.id)}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Marquer échoué
                          </button>
                        )}
                        {p.status === 'success' && (
                          <button
                            disabled={busyId === p.id}
                            onClick={() => refundPayment(p.id)}
                            className="rounded-lg bg-ink-100 px-3 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-200 disabled:opacity-50"
                          >
                            Rembourser
                          </button>
                        )}
                        {!(p.status === 'pending' || p.status === 'success') && (
                          <span className="text-ink-300">—</span>
                        )}
                      </div>
                      {p.status === 'pending' && p.purpose === 'ride_fare' && (
                        <p className="mt-1 text-xs text-ink-400">Confirmation automatique par le fournisseur Mobile Money.</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
