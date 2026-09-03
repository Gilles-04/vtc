import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { FraudFlagRow, FraudFlagStatus, FraudSeverity } from '../lib/types'
import { FraudFlagStatusBadge, FraudSeverityBadge, fraudSubjectTypeName } from '../components/Badge'

const STATUS_OPTIONS: { label: string; value: FraudFlagStatus | 'all' }[] = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'Ouvert', value: 'open' },
  { label: 'En revue', value: 'reviewing' },
  { label: 'Confirmé', value: 'confirmed' },
  { label: 'Rejeté', value: 'dismissed' },
]

const SEVERITY_OPTIONS: { label: string; value: FraudSeverity | 'all' }[] = [
  { label: 'Toutes sévérités', value: 'all' },
  { label: 'Élevée', value: 'high' },
  { label: 'Moyenne', value: 'medium' },
  { label: 'Faible', value: 'low' },
]

export function Fraud() {
  const [status, setStatus] = useState<FraudFlagStatus | 'all'>('open')
  const [severity, setSeverity] = useState<FraudSeverity | 'all'>('all')
  const [flags, setFlags] = useState<FraudFlagRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setFlags(null)
    let query = supabase
      .from('fraud_flags')
      .select('id, subject_type, subject_id, reason, severity, status, created_at, resolved_at, resolution_notes')
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (status !== 'all') query = query.eq('status', status)
    if (severity !== 'all') query = query.eq('severity', severity)

    query.then(({ data, error }) => {
      if (error) setError(error.message)
      else setFlags(data as FraudFlagRow[])
    })
  }, [status, severity])

  useEffect(() => {
    load()
  }, [load])

  async function resolve(id: string, newStatus: 'reviewing' | 'confirmed' | 'dismissed') {
    setActionError(null)
    let notes: string | null = null
    if (newStatus === 'confirmed' || newStatus === 'dismissed') {
      notes = window.prompt('Notes de décision (optionnel) :')
      if (notes === null) return
    }
    setBusyId(id)
    const { error } = await supabase.rpc('admin_resolve_fraud_flag', { _flag_id: id, _status: newStatus, _notes: notes || null })
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-ink-900">Fraude</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as FraudFlagStatus | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value as FraudSeverity | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {SEVERITY_OPTIONS.map((o) => (
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

      {!error && flags === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && flags !== null && flags.length === 0 && (
        <p className="text-sm text-ink-400">Aucun signalement pour ces filtres.</p>
      )}

      {!error && flags !== null && flags.length > 0 && (
        <div className="space-y-2">
          {flags.map((f) => (
            <div key={f.id} className="rounded-xl border border-ink-100 bg-white p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-ink-800">{fraudSubjectTypeName(f.subject_type)}</span>
                  <span className="ml-2 font-mono text-xs text-ink-400">{f.subject_id.slice(0, 12)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FraudSeverityBadge severity={f.severity} />
                  <FraudFlagStatusBadge status={f.status} />
                </div>
              </div>
              <p className="mb-2 text-sm text-ink-600">{f.reason}</p>
              {f.resolution_notes && <p className="mb-2 text-xs text-ink-400">Notes : {f.resolution_notes}</p>}
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-400">
                  {new Date(f.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
                {(f.status === 'open' || f.status === 'reviewing') && (
                  <div className="flex gap-2">
                    {f.status === 'open' && (
                      <button
                        disabled={busyId === f.id}
                        onClick={() => resolve(f.id, 'reviewing')}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100 disabled:opacity-50"
                      >
                        Mettre en revue
                      </button>
                    )}
                    <button
                      disabled={busyId === f.id}
                      onClick={() => resolve(f.id, 'confirmed')}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                    <button
                      disabled={busyId === f.id}
                      onClick={() => resolve(f.id, 'dismissed')}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 disabled:opacity-50"
                    >
                      Rejeter
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
