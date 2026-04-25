import { create } from 'zustand'
import type { Notification } from '@/types'
import { notificationService } from '@/services/notificationService'

interface NotificationStore {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean

  fetchNotifications: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true })
    try {
      const { notifications, unreadCount } = await notificationService.getNotifications()
      set({ notifications, unreadCount })
    } catch {
      // fail silently — notification errors must not break the app
    } finally {
      set({ isLoading: false })
    }
  },

  markRead: async (id) => {
    const prev = get().notifications
    const target = prev.find((n) => n.id === id)

    // optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true } : n,
      ),
      unreadCount: Math.max(0, state.unreadCount - (target && !target.isRead ? 1 : 0)),
    }))

    try {
      await notificationService.markRead(id)
    } catch {
      // revert on failure
      set({ notifications: prev, unreadCount: prev.filter((n) => !n.isRead).length })
    }
  },

  markAllRead: async () => {
    const prev = get().notifications

    // optimistic update
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }))

    try {
      await notificationService.markAllRead()
    } catch {
      // revert on failure
      set({ notifications: prev, unreadCount: prev.filter((n) => !n.isRead).length })
    }
  },
}))
