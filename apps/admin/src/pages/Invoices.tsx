import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { supabase } from '../lib/supabase'
import type { InvoiceListRow, PaymentMethodType } from '../lib/types'
import { fcfa } from '../lib/format'

const METHOD_OPTIONS: { label: string; value: PaymentMethodType | 'all' }[] = [
  { label: 'Tous les modes', value: 'all' },
  { label: 'Cash', value: 'cash' },
  { label: 'Mobile Money', value: 'mobile_money' },
]

const PERIOD_OPTIONS: { label: string; value: 'today' | '7d' | '30d' | 'all' }[] = [
  { label: "Aujourd'hui", value: 'today' },
  { label: '7 derniers jours', value: '7d' },
  { label: '30 derniers jours', value: '30d' },
  { label: 'Tout', value: 'all' },
]

function periodStart(period: 'today' | '7d' | '30d' | 'all'): string | null {
  const now = new Date()
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  }
  if (period === '7d') {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  }
  if (period === '30d') {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }
  return null
}

export function Invoices() {
  const [method, setMethod] = useState<PaymentMethodType | 'all'>('all')
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d')
  const [invoices, setInvoices] = useState<InvoiceListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setInvoices(null)
    let query = supabase
      .from('invoices')
      .select(
        'id, invoice_number, transport_amount_fcfa, platform_fee_fcfa, total_fcfa, payment_method, issued_at, profiles!passenger_id(phone, full_name), drivers(profiles(phone, full_name))',
      )
      .order('issued_at', { ascending: false })
      .limit(200)

    if (method !== 'all') query = query.eq('payment_method', method)
    const start = periodStart(period)
    if (start) query = query.gte('issued_at', start)

    query.then(({ data, error }) => {
      if (error) setError(error.message)
      else setInvoices(data as unknown as InvoiceListRow[])
    })
  }, [method, period])

  const totalFcfa = invoices?.reduce((sum, i) => sum + i.total_fcfa, 0) ?? 0
  const totalPlatformFee = invoices?.reduce((sum, i) => sum + i.platform_fee_fcfa, 0) ?? 0

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-ink-900">Facturation</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as PaymentMethodType | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as 'today' | '7d' | '30d' | 'all')}
          className="rounded-lg border border-ink-100 bg-white px-3 py-1.5 text-sm text-ink-800"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {!error && invoices === null && <p className="text-sm text-ink-400">Chargement…</p>}

      {!error && invoices !== null && invoices.length === 0 && (
        <p className="text-sm text-ink-400">Aucune facture pour ces filtres.</p>
      )}

      {!error && invoices !== null && invoices.length > 0 && (
        <>
          <p className="mb-3 text-sm text-ink-600">
            {invoices.length} facture{invoices.length > 1 ? 's' : ''} — {fcfa(totalFcfa)} au total, dont {fcfa(totalPlatformFee)} de frais de service
          </p>
          <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                <tr>
                  <th className="px-4 py-3">N° facture</th>
                  <th className="px-4 py-3">Passager</th>
                  <th className="px-4 py-3">Chauffeur</th>
                  <th className="px-4 py-3">Transport</th>
                  <th className="px-4 py-3">Frais de service</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3">Émise le</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-navy-700">
                      <Link to="/facturation/$invoiceId" params={{ invoiceId: i.id }} className="hover:underline">
                        {i.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-800">{i.profiles?.full_name || i.profiles?.phone || '—'}</td>
                    <td className="px-4 py-3 text-ink-600">
                      {i.drivers?.profiles?.full_name || i.drivers?.profiles?.phone || '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{fcfa(i.transport_amount_fcfa)}</td>
                    <td className="px-4 py-3 text-ink-600">{fcfa(i.platform_fee_fcfa)}</td>
                    <td className="px-4 py-3 font-medium text-ink-800">{fcfa(i.total_fcfa)}</td>
                    <td className="px-4 py-3 text-ink-600">{i.payment_method === 'cash' ? 'Cash' : 'Mobile Money'}</td>
                    <td className="px-4 py-3 text-ink-600">
                      {new Date(i.issued_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
