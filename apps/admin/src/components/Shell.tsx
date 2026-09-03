import type { ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'

const NAV_ITEMS = [
  { to: '/', label: "Vue d'ensemble" },
  { to: '/utilisateurs', label: 'Utilisateurs' },
  { to: '/chauffeurs', label: 'Chauffeurs' },
  { to: '/vehicules', label: 'Véhicules' },
  { to: '/courses', label: 'Courses' },
  { to: '/paiements', label: 'Paiements' },
  { to: '/facturation', label: 'Facturation' },
  { to: '/abonnements', label: 'Abonnements' },
  { to: '/reglements', label: 'Règlements' },
  { to: '/zones', label: 'Zones' },
] as const

export function Shell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="flex items-center justify-between border-b border-ink-100 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-600 text-lg">🚕</span>
            <span className="font-display text-sm font-bold text-ink-900">VTC Togo — Admin</span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100"
                activeProps={{ className: 'bg-navy-100 text-navy-700' }}
                activeOptions={{ exact: item.to === '/' }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
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
