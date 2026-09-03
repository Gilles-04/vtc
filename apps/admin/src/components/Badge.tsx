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
  cancelled_by_passenger: 'Annulée (passager)',
  cancelled_by_driver: 'Annulée (chauffeur)',
  cancelled_by_system: 'Annulée (système)',
}

export function RideStatusBadge({ status }: { status: string }) {
  return <Badge tone={rideStatusTone[status] ?? 'default'}>{rideStatusLabel[status] ?? status}</Badge>
}

const paymentStatusTone: Record<string, BadgeProps['tone']> = {
  pending: 'default',
  processing: 'gold',
  success: 'green',
  failed: 'red',
  cancelled: 'default',
  refunded: 'navy',
}

const paymentStatusLabel: Record<string, string> = {
  pending: 'En attente',
  processing: 'En cours',
  success: 'Réussi',
  failed: 'Échoué',
  cancelled: 'Annulé',
  refunded: 'Remboursé',
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return <Badge tone={paymentStatusTone[status] ?? 'default'}>{paymentStatusLabel[status] ?? status}</Badge>
}

const paymentPurposeTone: Record<string, BadgeProps['tone']> = {
  driver_subscription: 'gold',
  ride_fare: 'navy',
}

const paymentPurposeLabel: Record<string, string> = {
  driver_subscription: 'Abonnement chauffeur',
  ride_fare: 'Course',
}

export function PaymentPurposeBadge({ purpose }: { purpose: string }) {
  return <Badge tone={paymentPurposeTone[purpose] ?? 'default'}>{paymentPurposeLabel[purpose] ?? purpose}</Badge>
}

const paymentProviderLabel: Record<string, string> = {
  flooz: 'Flooz',
  tmoney: 'T-Money',
  manual: 'Manuel',
}

export function paymentProviderName(provider: string): string {
  return paymentProviderLabel[provider] ?? provider
}

const subscriptionStatusTone: Record<string, BadgeProps['tone']> = {
  active: 'green',
  expired: 'default',
  cancelled: 'red',
}

const subscriptionStatusLabel: Record<string, string> = {
  active: 'Actif',
  expired: 'Expiré',
  cancelled: 'Annulé',
}

export function SubscriptionStatusBadge({ status }: { status: string }) {
  return <Badge tone={subscriptionStatusTone[status] ?? 'default'}>{subscriptionStatusLabel[status] ?? status}</Badge>
}

const userRoleLabel: Record<string, string> = {
  passenger: 'Passager',
  driver: 'Chauffeur',
}

export function UserRoleBadge({ role }: { role: string }) {
  return <Badge tone={role === 'driver' ? 'navy' : 'default'}>{userRoleLabel[role] ?? role}</Badge>
}

const sosStatusTone: Record<string, BadgeProps['tone']> = {
  open: 'red',
  acknowledged: 'gold',
  resolved: 'green',
}

const sosStatusLabel: Record<string, string> = {
  open: 'Ouverte',
  acknowledged: 'Prise en compte',
  resolved: 'Résolue',
}

export function SosStatusBadge({ status }: { status: string }) {
  return <Badge tone={sosStatusTone[status] ?? 'default'}>{sosStatusLabel[status] ?? status}</Badge>
}

const reportStatusTone: Record<string, BadgeProps['tone']> = {
  open: 'gold',
  investigating: 'navy',
  resolved: 'green',
  dismissed: 'default',
}

const reportStatusLabel: Record<string, string> = {
  open: 'Ouvert',
  investigating: 'En cours',
  resolved: 'Résolu',
  dismissed: 'Rejeté',
}

export function ReportStatusBadge({ status }: { status: string }) {
  return <Badge tone={reportStatusTone[status] ?? 'default'}>{reportStatusLabel[status] ?? status}</Badge>
}
