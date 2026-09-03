import type { ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  tone?: 'default' | 'navy' | 'gold' | 'red' | 'green'
}

const toneClasses: Record<NonNullable<BadgeProps['tone']>, string> = {
  default: 'bg-ink-100 text-ink-600',
  navy: 'bg-navy-100 text-navy-700',
  gold: 'bg-gold-400/20 text-gold-600',
  red: 'bg-red-50 text-red-700',
  green: 'bg-green-50 text-green-700',
}

export function Badge({ children, tone = 'default' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  )
}

const driverStatusTone: Record<string, BadgeProps['tone']> = {
  pending_documents: 'default',
  pending_review: 'gold',
  approved: 'green',
  rejected: 'red',
  suspended: 'red',
}

const driverStatusLabel: Record<string, string> = {
  pending_documents: 'Documents manquants',
  pending_review: 'En attente de revue',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  suspended: 'Suspendu',
}

export function DriverStatusBadge({ status }: { status: string }) {
  return <Badge tone={driverStatusTone[status] ?? 'default'}>{driverStatusLabel[status] ?? status}</Badge>
}

export function CategoryBadge({ category }: { category: string }) {
  return <Badge tone="navy">{category === 'car' ? '🚗 Voiture' : '🏍️ Moto-taxi'}</Badge>
}
