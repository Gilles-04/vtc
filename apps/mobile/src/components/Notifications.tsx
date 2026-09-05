import { useEffect, useState } from 'react'
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'
import type { NotificationRow } from '../lib/types'

// Port de apps/web/src/components/Notifications.tsx — table `notifications`
// prête depuis la migration 1, jamais lue par aucun client jusqu'ici.
export function NotificationsButton({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase
      .from('notifications')
      .select('id, type, title, body, data, sent_at, read_at')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(30)
      .then(({ data }) => setNotifications((data as unknown as NotificationRow[]) ?? []))

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        setNotifications((prev) => [payload.new as NotificationRow, ...prev])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const unreadCount = notifications.filter((n) => !n.read_at).length

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id)
    if (unreadIds.length === 0) return
    const now = new Date().toISOString()
    setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })))
    await supabase.from('notifications').update({ read_at: now }).in('id', unreadIds)
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={styles.bellWrap}>
        <Text style={styles.bellText}>🔔</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <Pressable onPress={markAllRead}>
                  <Text style={styles.markAllText}>Tout marquer comme lu</Text>
                </Pressable>
              )}
            </View>
            <FlatList
              data={notifications}
              keyExtractor={(n) => n.id}
              ListEmptyComponent={<Text style={styles.emptyText}>Aucune notification.</Text>}
              renderItem={({ item }) => (
                <Pressable onPress={() => markRead(item.id)} style={[styles.row, !item.read_at && styles.rowUnread]}>
                  <Text style={styles.rowTitle}>{item.title}</Text>
                  <Text style={styles.rowBody}>{item.body}</Text>
                  <Text style={styles.rowDate}>
                    {new Date(item.sent_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  bellWrap: { position: 'relative' },
  bellText: { fontSize: 16 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red700,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 22, 34, 0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.ink100 },
  headerTitle: { fontSize: 14, fontWeight: '700', color: colors.ink800 },
  markAllText: { fontSize: 12, fontWeight: '600', color: colors.navy600 },
  emptyText: { textAlign: 'center', padding: 20, fontSize: 13, color: colors.ink400 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.ink100 },
  rowUnread: { backgroundColor: colors.navy50 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.ink800 },
  rowBody: { marginTop: 2, fontSize: 12, color: colors.ink600 },
  rowDate: { marginTop: 4, fontSize: 11, color: colors.ink400 },
})
