export type NotificationType =
  | 'REVIEW_COMPLETED'
  | 'REVIEW_FAILED'
  | 'CRITICAL_ISSUE'
  | 'MENTION'
  | 'COMMENT_REPLY'
  | 'TEAM_INVITE'

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
