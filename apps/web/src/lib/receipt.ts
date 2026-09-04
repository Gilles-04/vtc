import { jsPDF } from 'jspdf'
import type { SubscriptionPayment, SubscriptionPlan } from './types'
import { fcfa } from './format'

const PROVIDER_LABELS: Record<string, string> = {
  manual: 'Manuel (vérifié par la plateforme)',
  flooz: 'Flooz',
  tmoney: 'T-Money',
}

// Les polices standard de jsPDF (WinAnsiEncoding) ne connaissent pas
// l'espace fine insécable (U+202F) qu'`Intl.NumberFormat('fr-FR')` utilise
// comme séparateur de milliers dans `fcfa()` — rendu comme un caractère
// erroné dans le PDF sinon. Rien à voir avec `fcfa()` elle-même, correcte
// partout ailleurs (rendu navigateur) : uniquement un problème d'encodage
// propre à jsPDF, donc corrigé ici plutôt que dans `format.ts`.
function pdfSafe(text: string): string {
  return text.replace(/[  ]/g, ' ')
}

// Reçu simple pour un paiement d'abonnement chauffeur réussi (docs/10-paiements.md
// §Historique et reçus) — jamais utilisé pour une facture de course
// (`invoices`, rendu PDF non construit, voir le même document).
export function generateSubscriptionReceiptPdf(
  payment: SubscriptionPayment,
  plan: SubscriptionPlan | undefined,
  driverName: string | null,
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const marginX = 15
  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('VTC Togo', marginX, y)
  y += 8

  doc.setFontSize(11)
  doc.text(pdfSafe('Reçu de paiement — Abonnement chauffeur'), marginX, y)
  y += 12

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const paidAt = payment.confirmed_at ?? payment.created_at
  const rows: [string, string][] = [
    ['Reçu n°', payment.id.slice(0, 8).toUpperCase()],
    ['Date', new Date(paidAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
    ['Chauffeur', driverName ?? '—'],
    ['Plan', plan?.name ?? payment.metadata.plan_code ?? '—'],
    ['Mode de paiement', PROVIDER_LABELS[payment.provider] ?? payment.provider],
    ...(payment.provider_ref ? ([['Référence', payment.provider_ref]] as [string, string][]) : []),
    ['Montant payé', fcfa(payment.amount_fcfa)],
  ]

  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold')
    doc.text(pdfSafe(`${label} :`), marginX, y)
    doc.setFont('helvetica', 'normal')
    doc.text(pdfSafe(value), marginX + 40, y)
    y += 8
  }

  y += 6
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(pdfSafe('Ce reçu atteste du paiement de votre abonnement chauffeur VTC Togo.'), marginX, y)

  const dateSlug = new Date(paidAt).toISOString().slice(0, 10)
  doc.save(`recu-abonnement-${dateSlug}-${payment.id.slice(0, 8)}.pdf`)
}
