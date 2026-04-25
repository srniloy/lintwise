export type NotificationType = 'REVIEW_COMPLETE' | 'CRITICAL_ISSUE' | 'MENTION'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  isRead: boolean
  resourceId?: string
  resourceType?: 'REVIEW' | 'SNIPPET' | 'COLLECTION'
  createdAt: string
}

export interface NotificationPreferences {
  review_complete: boolean
  critical_issues: boolean
  team_mentions: boolean
}
