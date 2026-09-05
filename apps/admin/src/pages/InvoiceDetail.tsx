import { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { InvoiceDetailRow } from '../lib/types'
import { CategoryBadge } from '../components/Badge'
import { fcfa } from '../lib/format'

export function InvoiceDetail() {
  const { invoiceId } = useParams({ from: '/facturation/$invoiceId' })
  const [invoice, setInvoice] = useState<InvoiceDetailRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('invoices')
      .select(
        'id, invoice_number, ride_id, transport_amount_fcfa, platform_fee_fcfa, total_fcfa, payment_method, payment_reference, issued_at, profiles!passenger_id(phone, full_name), drivers(profiles(phone, full_name)), rides(category, pickup_address, dropoff_address, requested_at, completed_at)',
      )
      .eq('id', invoiceId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setInvoice(data as unknown as InvoiceDetailRow)
      })
  }, [invoiceId])

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    )
  }

  if (!invoice) {
    return <p className="p-8 text-sm text-ink-400">Chargement…</p>
  }

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Facture {invoice.invoice_number}</h1>
          <p className="mt-1 text-sm text-ink-600">
            {invoice.profiles?.full_name || invoice.profiles?.phone || '—'}
            {' → '}
            {invoice.drivers?.profiles?.full_name || invoice.drivers?.profiles?.phone || '—'}
          </p>
        </div>
        {invoice.rides && <CategoryBadge category={invoice.rides.category} />}
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <InfoCard label="Transport" value={fcfa(invoice.transport_amount_fcfa)} />
        <InfoCard label="Frais de service" value={fcfa(invoice.platform_fee_fcfa)} />
        <InfoCard label="Total" value={fcfa(invoice.total_fcfa)} emphasis />
      </section>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard label="Mode de paiement" value={invoice.payment_method === 'cash' ? 'Cash' : 'Mobile Money'} />
        <InfoCard label="Référence" value={invoice.payment_reference || '—'} />
      </section>

      {invoice.rides && (
        <section className="mb-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Trajet</h2>
          <p className="text-sm text-ink-800">
            <span className="font-medium">Départ :</span> {invoice.rides.pickup_address}
          </p>
          <p className="mt-1 text-sm text-ink-800">
            <span className="font-medium">Arrivée :</span> {invoice.rides.dropoff_address}
          </p>
          <p className="mt-3 text-xs text-ink-400">
            Demandée le {new Date(invoice.rides.requested_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {invoice.rides.completed_at &&
              ` — terminée le ${new Date(invoice.rides.completed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </section>
      )}

      <p className="text-xs text-ink-400">
        Facture émise le {new Date(invoice.issued_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}

function InfoCard({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 text-sm ${emphasis ? 'font-bold text-navy-700' : 'font-semibold text-ink-900'}`}>{value}</p>
    </div>
  )
}
