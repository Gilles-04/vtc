import { useCallback, useEffect, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { SelectField } from './SelectField'
import { SupportTicketStatusBadge } from './Badge'
import { colors } from '../theme'
import type { SupportMessageRow, SupportTicketCategory, SupportTicketRow } from '../lib/types'

const CATEGORIES: { value: SupportTicketCategory; label: string }[] = [
  { value: 'paiement', label: 'Paiement' },
  { value: 'course', label: 'Course' },
  { value: 'compte', label: 'Compte' },
  { value: 'document', label: 'Document' },
  { value: 'autre', label: 'Autre' },
]

type TicketView = 'list' | 'new' | 'detail'

// Port de apps/web/src/components/Support.tsx — écran transverse « Support »
// (docs/05-ecrans.md), voir TASK-048 pour le raisonnement complet.
export function SupportButton({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<TicketView>('list')
  const [tickets, setTickets] = useState<SupportTicketRow[] | null>(null)
  const [activeTicket, setActiveTicket] = useState<SupportTicketRow | null>(null)
  const [messages, setMessages] = useState<SupportMessageRow[]>([])
  const [category, setCategory] = useState<SupportTicketCategory>('autre')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  function resetForm() {
    setSubject('')
    setMessage('')
    setCategory('autre')
    setError(null)
  }

  async function submitNewTicket() {
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
    resetForm()
    setTickets(null)
    setView('list')
  }

  async function submitReply() {
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
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Text style={styles.signOut}>Support</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            {view === 'list' && (
              <>
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>Support</Text>
                  <Pressable
                    onPress={() => {
                      resetForm()
                      setView('new')
                    }}
                  >
                    <Text style={styles.markAllText}>Nouveau ticket</Text>
                  </Pressable>
                </View>
                <FlatList
                  data={tickets ?? []}
                  keyExtractor={(t) => t.id}
                  style={styles.list}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>{tickets === null ? 'Chargement…' : 'Aucun ticket pour le moment.'}</Text>
                  }
                  renderItem={({ item }) => (
                    <Pressable onPress={() => openTicket(item)} style={styles.row}>
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle}>{item.subject}</Text>
                        <SupportTicketStatusBadge status={item.status} />
                      </View>
                      <Text style={styles.rowDate}>
                        {CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category} —{' '}
                        {new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </Pressable>
                  )}
                />
                <Pressable onPress={() => setOpen(false)} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>Fermer</Text>
                </Pressable>
              </>
            )}

            {view === 'new' && (
              <View style={styles.form}>
                <Text style={styles.title}>Nouveau ticket</Text>

                <Text style={styles.label}>Catégorie</Text>
                <View style={styles.selectWrap}>
                  <SelectField value={category} onChange={(v) => setCategory(v as SupportTicketCategory)} options={CATEGORIES} placeholder="Choisir…" />
                </View>

                <Text style={styles.label}>Sujet</Text>
                <TextInput
                  value={subject}
                  onChangeText={setSubject}
                  placeholder="Résumez votre demande en quelques mots"
                  placeholderTextColor={colors.ink400}
                  style={styles.input}
                />

                <Text style={styles.label}>Message</Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={4}
                  placeholder="Décrivez votre problème…"
                  placeholderTextColor={colors.ink400}
                  style={styles.textarea}
                />

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <Pressable onPress={() => setView('list')} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Annuler</Text>
                  </Pressable>
                  <Pressable disabled={busy} onPress={submitNewTicket} style={[styles.primaryButton, { opacity: busy ? 0.5 : 1 }]}>
                    <Text style={styles.primaryButtonText}>{busy ? 'Envoi…' : 'Envoyer'}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {view === 'detail' && activeTicket && (
              <>
                <View style={styles.header}>
                  <Pressable onPress={() => setView('list')}>
                    <Text style={styles.backArrow}>←</Text>
                  </Pressable>
                  <Text style={styles.headerTitle} numberOfLines={1}>
                    {activeTicket.subject}
                  </Text>
                  <SupportTicketStatusBadge status={activeTicket.status} />
                </View>
                <FlatList
                  data={messages}
                  keyExtractor={(m) => m.id}
                  style={styles.list}
                  renderItem={({ item }) => (
                    <View style={[styles.bubble, item.sender_type === 'staff' ? styles.bubbleStaff : styles.bubbleUser]}>
                      <Text style={styles.bubbleText}>{item.body}</Text>
                      <Text style={styles.bubbleDate}>
                        {new Date(item.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  )}
                />
                {closed ? (
                  <Text style={styles.closedText}>Ce ticket est {activeTicket.status === 'resolved' ? 'résolu' : 'fermé'}.</Text>
                ) : (
                  <View style={styles.replyRow}>
                    <TextInput
                      value={reply}
                      onChangeText={setReply}
                      placeholder="Votre réponse…"
                      placeholderTextColor={colors.ink400}
                      style={styles.replyInput}
                    />
                    <Pressable disabled={busy || !reply.trim()} onPress={submitReply} style={[styles.replyButton, { opacity: busy || !reply.trim() ? 0.5 : 1 }]}>
                      <Text style={styles.replyButtonText}>Envoyer</Text>
                    </Pressable>
                  </View>
                )}
                {error && <Text style={styles.errorTextInline}>{error}</Text>}
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  signOut: { fontSize: 13, fontWeight: '600', color: colors.ink600 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 22, 34, 0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 16, borderBottomWidth: 1, borderBottomColor: colors.ink100 },
  headerTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.ink800 },
  markAllText: { fontSize: 12, fontWeight: '600', color: colors.navy600 },
  backArrow: { fontSize: 16, color: colors.ink400, paddingRight: 4 },
  list: { maxHeight: 420 },
  emptyText: { textAlign: 'center', padding: 20, fontSize: 13, color: colors.ink400 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.ink100 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink800 },
  rowDate: { marginTop: 4, fontSize: 11, color: colors.ink400 },
  closeButton: { borderTopWidth: 1, borderTopColor: colors.ink100, paddingVertical: 14, alignItems: 'center' },
  closeButtonText: { fontSize: 14, fontWeight: '500', color: colors.ink600 },
  form: { padding: 20 },
  title: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: colors.ink400, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink800, marginBottom: 6 },
  selectWrap: { marginBottom: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink900,
    marginBottom: 14,
  },
  textarea: {
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink900,
    marginBottom: 14,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  errorBox: { backgroundColor: colors.red50, borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: colors.red700, fontSize: 13 },
  errorTextInline: { color: colors.red700, fontSize: 12, paddingHorizontal: 16, paddingVertical: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  secondaryButton: { flex: 1, borderWidth: 1, borderColor: colors.ink100, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  secondaryButtonText: { fontSize: 14, fontWeight: '500', color: colors.ink600 },
  primaryButton: { flex: 1, backgroundColor: colors.navy600, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  bubble: { marginHorizontal: 16, marginVertical: 6, maxWidth: '85%', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.ink100 },
  bubbleStaff: { alignSelf: 'flex-start', backgroundColor: colors.navy50 },
  bubbleText: { fontSize: 14, color: colors.ink800 },
  bubbleDate: { marginTop: 4, fontSize: 10, color: colors.ink400 },
  closedText: { textAlign: 'center', padding: 14, fontSize: 12, color: colors.ink400, borderTopWidth: 1, borderTopColor: colors.ink100 },
  replyRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.ink100 },
  replyInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.ink100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink900,
  },
  replyButton: { backgroundColor: colors.navy600, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  replyButtonText: { color: colors.white, fontSize: 13, fontWeight: '600' },
})
