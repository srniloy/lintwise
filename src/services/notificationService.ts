import { api } from './apiClient'
import type { Notification, NotificationPreferences } from '@/types'

export const notificationService = {
  getNotifications: () =>
    api.get<{ notifications: Notification[]; unreadCount: number }>('/notifications'),

  markRead: (id: string) =>
    api.patch<Notification>(`/notifications/${id}/read`),

  markAllRead: () =>
    api.patch<void>('/notifications/read-all'),

  getPreferences: () =>
    api.get<NotificationPreferences>('/notifications/preferences'),

  updatePreferences: (prefs: Partial<NotificationPreferences>) =>
    api.put<NotificationPreferences>('/notifications/preferences', prefs),
}
