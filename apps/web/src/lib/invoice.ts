import { jsPDF } from 'jspdf'
import type { DriverPublicInfo, RideHistoryRow, RideInvoice } from './types'
import { fcfa } from './format'
import { pdfSafe } from './pdf'

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
}

// Facture de course (docs/10-paiements.md §Facturation) — générée
// automatiquement par `generate_invoice_on_ride_success`, jamais à la
// main. La plateforme émet ce document pour le compte du chauffeur,
// prestataire réel du transport (docs/01-architecture-fonctionnelle.md
// §Rôle des parties) — jamais présentée comme la partie qui transporte.
export function generateRideInvoicePdf(
  invoice: RideInvoice,
  ride: RideHistoryRow,
  driverInfo: DriverPublicInfo | null,
  passengerName: string | null,
): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const marginX = 15
  let y = 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('VTC Togo', marginX, y)
  y += 8

  doc.setFontSize(11)
  doc.text('Facture de course', marginX, y)
  y += 6

  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(pdfSafe(`Document émis par VTC Togo pour le compte du chauffeur, prestataire du transport.`), marginX, y)
  doc.setTextColor(0)
  y += 10

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const vehicle = [driverInfo?.vehicle_brand, driverInfo?.vehicle_model].filter(Boolean).join(' ')
  const rows: [string, string][] = [
    ['Facture n°', invoice.invoice_number],
    ['Date', new Date(invoice.issued_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
    ['Passager', passengerName ?? '—'],
    ['Chauffeur', driverInfo?.full_name ?? '—'],
    ['Véhicule', vehicle || '—'],
    ['Plaque', driverInfo?.vehicle_plate ?? '—'],
    ['Départ', ride.pickup_address],
    ['Arrivée', ride.dropoff_address],
    ...(ride.final_distance_km != null ? ([['Distance', `${ride.final_distance_km} km`]] as [string, string][]) : []),
    ['Mode de paiement', PAYMENT_METHOD_LABELS[invoice.payment_method] ?? invoice.payment_method],
    ...(invoice.payment_reference ? ([['Référence', invoice.payment_reference]] as [string, string][]) : []),
  ]

  for (const [label, value] of rows) {
    doc.setFont('helvetica', 'bold')
    doc.text(pdfSafe(`${label} :`), marginX, y)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(pdfSafe(value), 148 - marginX - 42)
    doc.text(lines, marginX + 42, y)
    y += 6 * lines.length + 2
  }

  y += 4
  doc.setDrawColor(200)
  doc.line(marginX, y, 148 - marginX, y)
  y += 8

  doc.setFontSize(10)
  const amountRows: [string, string][] = [
    ['Montant transport', fcfa(invoice.transport_amount_fcfa)],
    ['Frais de service plateforme', fcfa(invoice.platform_fee_fcfa)],
  ]
  for (const [label, value] of amountRows) {
    doc.setFont('helvetica', 'normal')
    doc.text(pdfSafe(label), marginX, y)
    doc.text(pdfSafe(value), 148 - marginX, y, { align: 'right' })
    y += 7
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Total payé', marginX, y)
  doc.text(pdfSafe(fcfa(invoice.total_fcfa)), 148 - marginX, y, { align: 'right' })

  const dateSlug = new Date(invoice.issued_at).toISOString().slice(0, 10)
  doc.save(`facture-${invoice.invoice_number}-${dateSlug}.pdf`)
}
