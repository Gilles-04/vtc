import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { SupportTicketStatusBadge } from './Badge'
import type { SupportMessageRow, SupportTicketCategory, SupportTicketRow } from '../lib/types'

const CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
  { value: 'paiement', label: 'Paiement' },
  { value: 'course', label: 'Course' },
  { value: 'compte', label: 'Compte' },
  { value: 'document', label: 'Document' },
  { value: 'autre', label: 'Autre' },
]

type View = 'list' | 'new' | 'detail'

// Écran transverse « Support » (docs/05-ecrans.md, passager et chauffeur) —
// `support_tickets`/`support_ticket_messages` ont leurs RLS et la RPC
// `create_support_ticket` (ouvre le ticket + son premier message d'un
// coup) prêtes depuis la migration 1, mais aucun client ne les a jamais
// appelées (voir TASK-048). `assert_not_suspended`/`enforce_rate_limit`
// (10 tickets/heure) déjà appliqués côté serveur par la RPC elle-même.
export function SupportButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('list')
  const [tickets, setTickets] = useState<SupportTicketRow[] | null>(null)
  const [activeTicket, setActiveTicket] = useState<SupportTicketRow | null>(null)
  const [messages, setMessages] = useState<SupportMessageRow[]>([])
  const [category, setCategory] = useState<SupportTicketCategory>('autre')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadTickets = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('id, category, subject, status, ride_id, created_at, resolved_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setTickets((data as unknown as SupportTicketRow[]) ?? [])
  }, [userId])

  useEffect(() => {
    if (open && view === 'list' && tickets === null) loadTickets()
  }, [open, view, tickets, loadTickets])

  async function openTicket(ticket: SupportTicketRow) {
    setActiveTicket(ticket)
    setView('detail')
    setError(null)
    const { data } = await supabase
      .from('support_ticket_messages')
      .select('id, ticket_id, sender_id, sender_type, body, created_at')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
    setMessages((data as unknown as SupportMessageRow[]) ?? [])
  }

  useEffect(() => {
    if (!activeTicket) return
    const channel = supabase
      .channel(`support-ticket-${activeTicket.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_ticket_messages', filter: `ticket_id=eq.${activeTicket.id}` },
        (payload) => setMessages((prev) => [...prev, payload.new as SupportMessageRow]),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeTicket])

  async function submitNewTicket(e: FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) {
      setError('Renseignez un sujet et un message.')
      return
    }
    setError(null)
    setBusy(true)
    const { error: rpcError } = await supabase.rpc('create_support_ticket', {
      _category: category,
      _subject: subject.trim(),
      _message: message.trim(),
      _ride_id: null,
    })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setSubject('')
    setMessage('')
    setCategory('autre')
    setTickets(null)
    setView('list')
  }

  async function submitReply(e: FormEvent) {
    e.preventDefault()
    if (!activeTicket || !reply.trim()) return
    setError(null)
    setBusy(true)
    const { error: insertError } = await supabase.from('support_ticket_messages').insert({
      ticket_id: activeTicket.id,
      sender_id: userId,
      sender_type: 'user',
      body: reply.trim(),
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setReply('')
  }

  const closed = activeTicket?.status === 'resolved' || activeTicket?.status === 'closed'

  return (
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-ink-600 hover:underline">
        Support
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:items-start sm:bg-transparent sm:p-0">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-ink-100 bg-white shadow-lg">
            {view === 'list' && (
              <>
                <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                  <span className="text-sm font-semibold text-ink-800">Support</span>
                  <button
                    onClick={() => {
                      setError(null)
                      setView('new')
                    }}
                    className="text-xs font-medium text-navy-600 hover:underline"
                  >
                    Nouveau ticket
                  </button>
                </div>
                <div className="overflow-y-auto">
                  {tickets === null && <p className="p-4 text-center text-sm text-ink-400">Chargement…</p>}
                  {tickets !== null && tickets.length === 0 && (
                    <p className="p-4 text-center text-sm text-ink-400">Aucun ticket pour le moment.</p>
                  )}
                  {tickets?.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => openTicket(t)}
                      className="block w-full border-b border-ink-100 px-4 py-3 text-left last:border-0 hover:bg-ink-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink-800">{t.subject}</p>
                        <SupportTicketStatusBadge status={t.status} />
                      </div>
                      <p className="mt-1 text-[11px] text-ink-400">
                        {CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category} —{' '}
                        {new Date(t.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </button>
                  ))}
                </div>
                <button onClick={() => setOpen(false)} className="border-t border-ink-100 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50">
                  Fermer
                </button>
              </>
            )}

            {view === 'new' && (
              <form onSubmit={submitNewTicket} className="flex flex-col p-4">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">Nouveau ticket</h2>

                <label className="mb-1 block text-sm font-medium text-ink-800">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                  className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm text-ink-800"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <label className="mb-1 block text-sm font-medium text-ink-800">Sujet</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Résumez votre demande en quelques mots"
                  className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                />

                <label className="mb-1 block text-sm font-medium text-ink-800">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Décrivez votre problème…"
                  className="mb-4 w-full rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                />

                {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setView('list')}
                    className="flex-1 rounded-lg border border-ink-100 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex-1 rounded-lg bg-navy-600 py-2.5 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                  >
                    {busy ? 'Envoi…' : 'Envoyer'}
                  </button>
                </div>
              </form>
            )}

            {view === 'detail' && activeTicket && (
              <>
                <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-3">
                  <button onClick={() => setView('list')} className="text-sm text-ink-400 hover:text-ink-600">
                    ←
                  </button>
                  <span className="flex-1 truncate text-sm font-semibold text-ink-800">{activeTicket.subject}</span>
                  <SupportTicketStatusBadge status={activeTicket.status} />
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-4">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        m.sender_type === 'staff' ? 'bg-navy-50 text-navy-800' : 'ml-auto bg-ink-100 text-ink-800'
                      }`}
                    >
                      <p>{m.body}</p>
                      <p className="mt-1 text-[10px] text-ink-400">
                        {new Date(m.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                </div>
                {closed ? (
                  <p className="border-t border-ink-100 px-4 py-3 text-center text-xs text-ink-400">Ce ticket est {activeTicket.status === 'resolved' ? 'résolu' : 'fermé'}.</p>
                ) : (
                  <form onSubmit={submitReply} className="flex gap-2 border-t border-ink-100 p-3">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Votre réponse…"
                      className="flex-1 rounded-lg border border-ink-100 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500"
                    />
                    <button
                      type="submit"
                      disabled={busy || !reply.trim()}
                      className="rounded-lg bg-navy-600 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                    >
                      Envoyer
                    </button>
                  </form>
                )}
                {error && <p className="border-t border-ink-100 px-4 py-2 text-xs text-red-700">{error}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
