import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { UserListRow } from '../lib/types'
import { Badge, UserRoleBadge } from '../components/Badge'

const STATUS_OPTIONS = [
  { label: 'Tous les statuts', value: 'all' },
  { label: 'Actif', value: 'active' },
  { label: 'Suspendu', value: 'suspended' },
] as const

export function Users() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all')
  const [users, setUsers] = useState<UserListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUsers(null)
    let query = supabase
      .from('profiles')
      .select('id, full_name, phone, is_suspended, created_at, user_roles(role)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (status === 'active') query = query.eq('is_suspended', false)
    if (status === 'suspended') query = query.eq('is_suspended', true)
    if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`)

    const timeout = setTimeout(() => {
      query.then(({ data, error }) => {
        if (error) setError(error.message)
        else setUsers(data as unknown as UserListRow[])
      })
    }, 300)

    return () => clearTimeout(timeout)
  }, [search, status])

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-ink-900">Utilisateurs</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher nom ou téléphone…"
          className="w-64 rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800 outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
        />

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'suspended')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!error && users === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && users !== null && users.length === 0 && (
        <p className="text-sm text-ink-400">Aucun utilisateur pour ces filtres.</p>
      )}

      {!error && users !== null && users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Rôles</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-4 py-3">
                    <Link to="/utilisateurs/$userId" params={{ userId: u.id }} className="font-medium text-navy-700 hover:underline">
                      {u.full_name || u.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {u.user_roles.length === 0 && <span className="text-ink-400">—</span>}
                      {u.user_roles.map((r) => (
                        <UserRoleBadge key={r.role} role={r.role} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.is_suspended ? 'red' : 'green'}>{u.is_suspended ? 'Suspendu' : 'Actif'}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
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
