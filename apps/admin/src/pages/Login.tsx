import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message === 'Invalid login credentials' ? 'Identifiants incorrects.' : error.message)
      return
    }
    navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-600 text-2xl">
            🚕
          </div>
          <h1 className="text-2xl font-bold text-ink-900">VTC Togo</h1>
          <p className="mt-1 text-sm text-ink-600">Dashboard admin</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-ink-800">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
            placeholder="vous@vtctogo.com"
          />

          <label className="mb-1 block text-sm font-medium text-ink-800">Mot de passe</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
            placeholder="••••••••"
          />

          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700 disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-ink-400">
          Accès réservé au staff — les comptes sont créés manuellement par un super-admin.
        </p>
      </div>
    </div>
  )
}
