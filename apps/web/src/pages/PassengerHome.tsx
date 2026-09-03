import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'

export function PassengerHome() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate({ to: '/passager' })
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-600 text-lg">🚕</span>
          <span className="font-display text-lg font-bold text-ink-900">VTC Togo</span>
        </div>
        <button onClick={handleSignOut} className="text-sm font-medium text-ink-600 hover:underline">
          Se déconnecter
        </button>
      </header>

      <main className="flex flex-col items-center px-6 py-16 text-center">
        <span className="text-3xl">🚧</span>
        <h1 className="mt-4 text-xl font-bold text-ink-900">Compte connecté</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-600">
          La demande de course en ligne arrive prochainement — elle dépend encore du choix du
          fournisseur de cartographie.
        </p>
      </main>
    </div>
  )
}
