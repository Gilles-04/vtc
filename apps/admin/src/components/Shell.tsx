import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'

export function Shell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="flex items-center justify-between border-b border-ink-100 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-600 text-lg">🚕</span>
          <span className="font-display text-sm font-bold text-ink-900">VTC Togo — Admin</span>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100"
        >
          Se déconnecter
        </button>
      </header>
      <main>{children}</main>
    </div>
  )
}
