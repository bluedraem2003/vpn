import { useCallback, useEffect, useState } from 'react'
import { api, type NotificationDto } from '../api/client'
import { useAuth } from '../auth/AuthContext'

const POLL_MS = 60_000

/** Unread badge + list for the current workspace; polls once a minute while the tab is visible. */
export function useNotifications(opts?: { limit?: number; live?: boolean }) {
  const { workspaceId } = useAuth()
  const limit = opts?.limit || 50
  const live = opts?.live !== false
  const [items, setItems] = useState<NotificationDto[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!workspaceId) return
    try {
      const res = await api.notifications(workspaceId, { limit })
      setItems(res.items)
      setUnread(res.unreadCount)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [workspaceId, limit])

  useEffect(() => {
    void reload()
    if (!live) return
    const tick = () => {
      if (document.visibilityState === 'visible') void reload()
    }
    const id = window.setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [reload, live])

  const markAllRead = useCallback(async () => {
    if (!workspaceId) return
    const res = await api.markNotificationsRead(workspaceId, { all: true })
    setUnread(res.unreadCount)
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt || new Date().toISOString() })))
  }, [workspaceId])

  return { items, unread, loading, error, reload, markAllRead }
}
