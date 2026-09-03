import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'

interface NavLeaf {
  to: string
  label: string
}

interface NavGroupDef {
  label: string
  items: NavLeaf[]
}

const STANDALONE_ITEMS: NavLeaf[] = [{ to: '/', label: "Vue d'ensemble" }]

const NAV_GROUPS: NavGroupDef[] = [
  {
    label: 'Opérations',
    items: [
      { to: '/utilisateurs', label: 'Utilisateurs' },
      { to: '/chauffeurs', label: 'Chauffeurs' },
      { to: '/vehicules', label: 'Véhicules' },
      { to: '/courses', label: 'Courses' },
    ],
  },
  {
    label: 'Financier',
    items: [
      { to: '/paiements', label: 'Paiements' },
      { to: '/facturation', label: 'Facturation' },
      { to: '/abonnements', label: 'Abonnements' },
      { to: '/reglements', label: 'Règlements' },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { to: '/zones', label: 'Zones' },
      { to: '/tarification', label: 'Tarification' },
    ],
  },
  {
    label: 'Modération',
    items: [
      { to: '/reclamations', label: 'Réclamations & SOS' },
      { to: '/fraude', label: 'Fraude' },
    ],
  },
]

const TRAILING_ITEMS: NavLeaf[] = [{ to: '/statistiques', label: 'Statistiques' }]

function NavGroup({ group, currentPath }: { group: NavGroupDef; currentPath: string }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isActive = group.items.some((item) => currentPath === item.to || currentPath.startsWith(`${item.to}/`))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-ink-100 ${
          isActive ? 'bg-navy-100 text-navy-700' : 'text-ink-600'
        }`}
      >
        {group.label}
        <span className="text-xs">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-lg border border-ink-100 bg-white py-1 shadow-lg">
          {group.items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
              activeProps={{ className: 'bg-navy-100 text-navy-700' }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const currentPath = useRouterState({ select: (s) => s.location.pathname })

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
            {STANDALONE_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100"
                activeProps={{ className: 'bg-navy-100 text-navy-700' }}
                activeOptions={{ exact: true }}
              >
                {item.label}
              </Link>
            ))}
            {NAV_GROUPS.map((group) => (
              <NavGroup key={group.label} group={group} currentPath={currentPath} />
            ))}
            {TRAILING_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100"
                activeProps={{ className: 'bg-navy-100 text-navy-700' }}
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
