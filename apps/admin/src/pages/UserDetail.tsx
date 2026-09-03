import { useCallback, useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { UserDetail as UserDetailRow, UserRideHistoryRow } from '../lib/types'
import { Badge, UserRoleBadge, CategoryBadge, RideStatusBadge } from '../components/Badge'
import { fcfa } from '../lib/format'

export function UserDetail() {
  const { userId } = useParams({ from: '/utilisateurs/$userId' })
  const [user, setUser] = useState<UserDetailRow | null>(null)
  const [rides, setRides] = useState<UserRideHistoryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setUser(null)
    supabase
      .from('profiles')
      .select('id, full_name, phone, language, is_suspended, suspended_reason, created_at, user_roles(role)')
      .eq('id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setUser(data as unknown as UserDetailRow)
      })

    supabase
      .from('rides')
      .select('id, category, status, pickup_address, dropoff_address, final_fare_fcfa, estimated_fare_fcfa, requested_at')
      .eq('passenger_id', userId)
      .order('requested_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setRides((data as UserRideHistoryRow[]) ?? []))
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  async function toggleSuspend() {
    setActionError(null)
    if (!user) return
    if (user.is_suspended) {
      if (!window.confirm('Réactiver ce compte ?')) return
      setBusy(true)
      const { error } = await supabase.rpc('admin_unsuspend_user', { _user_id: user.id })
      setBusy(false)
      if (error) {
        setActionError(error.message)
        return
      }
      load()
      return
    }

    const reason = window.prompt('Motif de la suspension (visible en interne) :')
    if (reason === null) return
    if (!window.confirm('Suspendre ce compte ?')) return
    setBusy(true)
    const { error } = await supabase.rpc('admin_suspend_user', { _user_id: user.id, _reason: reason })
    setBusy(false)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    )
  }

  if (!user) {
    return <p className="p-8 text-sm text-ink-400">Chargement…</p>
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{user.full_name || user.id.slice(0, 8)}</h1>
          <p className="mt-1 text-sm text-ink-600">{user.phone || 'Téléphone non renseigné'}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.user_roles.map((r) => (
            <UserRoleBadge key={r.role} role={r.role} />
          ))}
          <Badge tone={user.is_suspended ? 'red' : 'green'}>{user.is_suspended ? 'Suspendu' : 'Actif'}</Badge>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <InfoCard label="Langue" value={user.language === 'fr' ? 'Français' : 'English'} />
        <InfoCard label="Inscrit le" value={new Date(user.created_at).toLocaleDateString('fr-FR')} />
        <InfoCard label="Motif suspension" value={user.suspended_reason || '—'} />
      </section>

      <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Compte</h2>
        <button
          disabled={busy}
          onClick={toggleSuspend}
          className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
            user.is_suspended ? 'bg-navy-600 text-white hover:bg-navy-700' : 'bg-red-50 text-red-700 hover:bg-red-100'
          }`}
        >
          {user.is_suspended ? 'Réactiver le compte' : 'Suspendre le compte'}
        </button>
      </section>

      <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Historique des courses (passager)
        </h2>
        {rides === null && <p className="text-sm text-ink-400">Chargement…</p>}
        {rides !== null && rides.length === 0 && <p className="text-sm text-ink-400">Aucune course.</p>}
        {rides !== null && rides.length > 0 && (
          <div className="space-y-2">
            {rides.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink-100 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={r.category} />
                  <span className="max-w-[280px] truncate text-ink-600" title={`${r.pickup_address} → ${r.dropoff_address}`}>
                    {r.pickup_address} → {r.dropoff_address}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-ink-600">
                    {r.final_fare_fcfa != null ? fcfa(r.final_fare_fcfa) : r.estimated_fare_fcfa != null ? `~${fcfa(r.estimated_fare_fcfa)}` : '—'}
                  </span>
                  <RideStatusBadge status={r.status} />
                  <span className="text-ink-400">{new Date(r.requested_at).toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-ink-900">{value}</p>
    </div>
  )
}
