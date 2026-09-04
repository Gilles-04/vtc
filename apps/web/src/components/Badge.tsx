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

const rideStatusTone: Record<string, BadgeProps['tone']> = {
  requested: 'default',
  searching: 'gold',
  accepted: 'navy',
  driver_arriving: 'navy',
  driver_arrived: 'navy',
  in_progress: 'navy',
  completed: 'green',
  cancelled_by_passenger: 'red',
  cancelled_by_driver: 'red',
  cancelled_by_system: 'red',
}

const rideStatusLabel: Record<string, string> = {
  requested: 'Demandée',
  searching: 'Recherche chauffeur',
  accepted: 'Acceptée',
  driver_arriving: 'Chauffeur en route',
  driver_arrived: 'Chauffeur arrivé',
  in_progress: 'En cours',
  completed: 'Terminée',
  cancelled_by_passenger: 'Annulée (vous)',
  cancelled_by_driver: 'Annulée (chauffeur)',
  cancelled_by_system: 'Annulée (système)',
}

export function RideStatusBadge({ status }: { status: string }) {
  return <Badge tone={rideStatusTone[status] ?? 'default'}>{rideStatusLabel[status] ?? status}</Badge>
}

const docStatusTone: Record<string, BadgeProps['tone']> = {
  pending: 'gold',
  approved: 'green',
  rejected: 'red',
}

const docStatusLabel: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvé',
  rejected: 'Rejeté',
}

export function DocStatusBadge({ status }: { status: string }) {
  return <Badge tone={docStatusTone[status] ?? 'default'}>{docStatusLabel[status] ?? status}</Badge>
}
