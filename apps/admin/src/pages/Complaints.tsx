import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ReportRow, SosAlertRow, SupportMessageRow, SupportTicketRow } from '../lib/types'
import { SosStatusBadge, ReportStatusBadge, SupportTicketStatusBadge } from '../components/Badge'

export function Complaints() {
  const [sosAlerts, setSosAlerts] = useState<SosAlertRow[] | null>(null)
  const [reports, setReports] = useState<ReportRow[] | null>(null)
  const [tickets, setTickets] = useState<SupportTicketRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [adminId, setAdminId] = useState<string | null>(null)
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null)
  const [ticketMessages, setTicketMessages] = useState<SupportMessageRow[]>([])
  const [replyText, setReplyText] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAdminId(data.user?.id ?? null))
  }, [])

  const load = useCallback(() => {
    setSosAlerts(null)
    setReports(null)
    setTickets(null)

    supabase
      .from('sos_alerts')
      .select('id, status, ride_id, created_at, resolved_at, profiles(phone, full_name)')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setSosAlerts(data as unknown as SosAlertRow[])
      })

    supabase
      .from('reports')
      .select(
        'id, category, description, status, ride_id, created_at, resolved_at, resolution_notes, reporter:profiles!reports_reporter_id_profiles_fkey(phone, full_name), reported:profiles!reports_reported_user_id_profiles_fkey(phone, full_name)',
      )
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setReports(data as unknown as ReportRow[])
      })

    // `support_tickets` — RLS/RPC prêtes depuis la migration 1, FK vers
    // `profiles` ajoutée pour l'embed (TASK-048, même bug que
    // reports/sos_alerts), jamais traité côté admin jusqu'ici.
    supabase
      .from('support_tickets')
      .select('id, category, subject, status, ride_id, assigned_to, created_at, resolved_at, profiles(phone, full_name)')
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setTickets(data as unknown as SupportTicketRow[])
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function loadTicketMessages(id: string) {
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('id, ticket_id, sender_id, sender_type, body, created_at')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })
    setTicketMessages((data as unknown as SupportMessageRow[]) ?? [])
  }

  function toggleTicket(id: string) {
    if (expandedTicket === id) {
      setExpandedTicket(null)
      return
    }
    setExpandedTicket(id)
    setReplyText('')
    loadTicketMessages(id)
  }

  async function assignToSelf(id: string) {
    if (!adminId) return
    setActionError(null)
    setBusyId(id)
    const { error } = await supabase.rpc('admin_assign_support_ticket', { _ticket_id: id, _assignee: adminId })
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  async function sendStaffReply(id: string) {
    if (!adminId || !replyText.trim()) return
    setActionError(null)
    const { error } = await supabase
      .from('support_ticket_messages')
      .insert({ ticket_id: id, sender_id: adminId, sender_type: 'staff', body: replyText.trim() })
    if (error) {
      setActionError(error.message)
      return
    }
    setReplyText('')
    loadTicketMessages(id)
  }

  async function resolveTicket(id: string) {
    setActionError(null)
    if (!window.confirm('Marquer ce ticket comme résolu ?')) return
    setBusyId(id)
    const { error } = await supabase.rpc('admin_resolve_support_ticket', { _ticket_id: id, _resolution_message: null })
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    setExpandedTicket(null)
    load()
  }

  async function resolveSos(id: string) {
    setActionError(null)
    if (!window.confirm('Marquer cette alerte SOS comme résolue ?')) return
    setBusyId(id)
    const { error } = await supabase.rpc('admin_resolve_sos', { _sos_id: id })
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  async function resolveReport(id: string, status: 'investigating' | 'resolved' | 'dismissed') {
    setActionError(null)
    let notes: string | null = null
    if (status === 'resolved' || status === 'dismissed') {
      notes = window.prompt('Notes de résolution (optionnel) :')
      if (notes === null) notes = ''
    }
    setBusyId(id)
    const { error } = await supabase.rpc('admin_resolve_report', { _report_id: id, _status: status, _notes: notes || null })
    setBusyId(null)
    if (error) {
      setActionError(error.message)
      return
    }
    load()
  }

  const openSos = sosAlerts?.filter((s) => s.status !== 'resolved') ?? []
  const resolvedSos = sosAlerts?.filter((s) => s.status === 'resolved') ?? []
  const openReports = reports?.filter((r) => r.status === 'open' || r.status === 'investigating') ?? []
  const closedReports = reports?.filter((r) => r.status === 'resolved' || r.status === 'dismissed') ?? []
  const openTickets = tickets?.filter((t) => t.status === 'open' || t.status === 'pending') ?? []
  const closedTickets = tickets?.filter((t) => t.status === 'resolved' || t.status === 'closed') ?? []

  return (
    <div className="p-6 sm:p-8">
      <h1 className="mb-6 text-xl font-bold text-ink-900">Réclamations &amp; SOS</h1>

      {(error || actionError) && (
        <div className="mb-4 max-w-lg rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error || actionError}
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-700">
          Alertes SOS {openSos.length > 0 && `(${openSos.length} active${openSos.length > 1 ? 's' : ''})`}
        </h2>
        {sosAlerts === null && <p className="text-sm text-ink-400">Chargement…</p>}
        {sosAlerts !== null && openSos.length === 0 && <p className="text-sm text-ink-400">Aucune alerte SOS active.</p>}
        {openSos.length > 0 && (
          <div className="space-y-2">
            {openSos.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50/50 p-4">
                <div>
                  <p className="font-medium text-ink-800">{s.profiles?.full_name || s.profiles?.phone || s.id.slice(0, 8)}</p>
                  <p className="text-xs text-ink-400">
                    {new Date(s.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {s.ride_id && ` — course ${s.ride_id.slice(0, 8)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SosStatusBadge status={s.status} />
                  <button
                    disabled={busyId === s.id}
                    onClick={() => resolveSos(s.id)}
                    className="rounded-lg bg-navy-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                  >
                    Résoudre
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {resolvedSos.length > 0 && (
          <p className="mt-2 text-xs text-ink-400">{resolvedSos.length} alerte(s) SOS résolue(s), non affichée(s) ici.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Réclamations {openReports.length > 0 && `(${openReports.length} ouverte${openReports.length > 1 ? 's' : ''})`}
        </h2>
        {reports === null && <p className="text-sm text-ink-400">Chargement…</p>}
        {reports !== null && reports.length === 0 && <p className="text-sm text-ink-400">Aucune réclamation.</p>}
        {reports !== null && reports.length > 0 && (
          <div className="space-y-2">
            {[...openReports, ...closedReports].map((r) => (
              <div key={r.id} className="rounded-xl border border-ink-100 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium text-ink-800">{r.category}</span>
                    <span className="ml-2 text-xs text-ink-400">
                      {r.reporter?.full_name || r.reporter?.phone || '—'} → {r.reported?.full_name || r.reported?.phone || '—'}
                    </span>
                  </div>
                  <ReportStatusBadge status={r.status} />
                </div>
                <p className="mb-2 text-sm text-ink-600">{r.description}</p>
                {r.resolution_notes && <p className="mb-2 text-xs text-ink-400">Notes : {r.resolution_notes}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-400">
                    {new Date(r.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {(r.status === 'open' || r.status === 'investigating') && (
                    <div className="flex gap-2">
                      {r.status === 'open' && (
                        <button
                          disabled={busyId === r.id}
                          onClick={() => resolveReport(r.id, 'investigating')}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100 disabled:opacity-50"
                        >
                          Prendre en charge
                        </button>
                      )}
                      <button
                        disabled={busyId === r.id}
                        onClick={() => resolveReport(r.id, 'resolved')}
                        className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        Résoudre
                      </button>
                      <button
                        disabled={busyId === r.id}
                        onClick={() => resolveReport(r.id, 'dismissed')}
                        className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Rejeter
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">
          Tickets support {openTickets.length > 0 && `(${openTickets.length} ouvert${openTickets.length > 1 ? 's' : ''})`}
        </h2>
        {tickets === null && <p className="text-sm text-ink-400">Chargement…</p>}
        {tickets !== null && tickets.length === 0 && <p className="text-sm text-ink-400">Aucun ticket support.</p>}
        {tickets !== null && tickets.length > 0 && (
          <div className="space-y-2">
            {[...openTickets, ...closedTickets].map((t) => (
              <div key={t.id} className="rounded-xl border border-ink-100 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-medium text-ink-800">{t.subject}</span>
                    <span className="ml-2 text-xs text-ink-400">
                      {t.category} — {t.profiles?.full_name || t.profiles?.phone || '—'}
                    </span>
                  </div>
                  <SupportTicketStatusBadge status={t.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-400">
                    {new Date(t.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {!t.assigned_to && t.status === 'open' && ' — non assigné'}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => toggleTicket(t.id)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100">
                      {expandedTicket === t.id ? 'Masquer' : 'Voir la conversation'}
                    </button>
                    {(t.status === 'open' || t.status === 'pending') && (
                      <>
                        {!t.assigned_to && (
                          <button
                            disabled={busyId === t.id}
                            onClick={() => assignToSelf(t.id)}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-navy-700 hover:bg-navy-100 disabled:opacity-50"
                          >
                            Prendre en charge
                          </button>
                        )}
                        <button
                          disabled={busyId === t.id}
                          onClick={() => resolveTicket(t.id)}
                          className="rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          Résoudre
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expandedTicket === t.id && (
                  <div className="mt-3 border-t border-ink-100 pt-3">
                    <div className="mb-3 max-h-64 space-y-2 overflow-y-auto">
                      {ticketMessages.map((m) => (
                        <div
                          key={m.id}
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                            m.sender_type === 'staff' ? 'ml-auto bg-navy-50 text-navy-800' : 'bg-ink-100 text-ink-800'
                          }`}
                        >
                          <p>{m.body}</p>
                          <p className="mt-1 text-[10px] text-ink-400">
                            {new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))}
                    </div>
                    {(t.status === 'open' || t.status === 'pending') && (
                      <div className="flex gap-2">
                        <input
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Répondre au client…"
                          className="flex-1 rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                        />
                        <button
                          disabled={!replyText.trim()}
                          onClick={() => sendStaffReply(t.id)}
                          className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                        >
                          Envoyer
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
