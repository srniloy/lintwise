import { useEffect } from 'react'
import { useNotificationStore } from '@/store/notificationStore'

const POLL_INTERVAL_MS = 30_000

export function useNotifications() {
  const { fetchNotifications, notifications, unreadCount, isLoading, markRead, markAllRead } =
    useNotificationStore()

  useEffect(() => {
    void fetchNotifications()
    const id = setInterval(() => void fetchNotifications(), POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchNotifications])

  return { notifications, unreadCount, isLoading, markRead, markAllRead }
}
