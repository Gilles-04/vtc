import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

type Tone = 'default' | 'navy' | 'gold' | 'red' | 'green'

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  default: { bg: colors.ink100, fg: colors.ink600 },
  navy: { bg: colors.navy100, fg: colors.navy700 },
  gold: { bg: '#fdf3d9', fg: colors.gold600 },
  red: { bg: colors.red50, fg: colors.red700 },
  green: { bg: '#ecfdf3', fg: '#15803d' },
}

export function Badge({ children, tone = 'default' }: { children: string; tone?: Tone }) {
  const t = toneStyles[tone]
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{children}</Text>
    </View>
  )
}

const driverStatusTone: Record<string, Tone> = {
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

const rideStatusTone: Record<string, Tone> = {
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

const docStatusTone: Record<string, Tone> = {
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

const supportTicketStatusTone: Record<string, Tone> = {
  open: 'gold',
  pending: 'navy',
  resolved: 'green',
  closed: 'default',
}
const supportTicketStatusLabel: Record<string, string> = {
  open: 'Ouvert',
  pending: 'En cours',
  resolved: 'Résolu',
  closed: 'Fermé',
}
export function SupportTicketStatusBadge({ status }: { status: string }) {
  return <Badge tone={supportTicketStatusTone[status] ?? 'default'}>{supportTicketStatusLabel[status] ?? status}</Badge>
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 12, fontWeight: '600' },
})
