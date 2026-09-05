import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { NotificationRow } from '../lib/types'

// Table `notifications` prête depuis la migration 1 (RLS + grants
// complets, `read_at` pour marquer comme lu) et alimentée par une
// dizaine de déclencheurs (statuts de course, matching, abonnement,
// fiabilité, SOS) — jamais lue par aucun client jusqu'ici, seul le canal
// push (lui-même jamais réellement livré avant TASK-045) existait.
export function NotificationsBell({ userId }: { userId: string }) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
    <div ref={containerRef} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="relative text-sm font-medium text-ink-600 hover:underline">
        🔔
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 max-w-[90vw] rounded-2xl border border-ink-100 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <span className="text-sm font-semibold text-ink-800">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-navy-600 hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && <p className="p-4 text-center text-sm text-ink-400">Aucune notification.</p>}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`block w-full border-b border-ink-100 px-4 py-3 text-left last:border-0 hover:bg-ink-50 ${
                  n.read_at ? '' : 'bg-navy-50'
                }`}
              >
                <p className="text-sm font-medium text-ink-800">{n.title}</p>
                <p className="mt-0.5 text-xs text-ink-600">{n.body}</p>
                <p className="mt-1 text-[11px] text-ink-400">
                  {new Date(n.sent_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
