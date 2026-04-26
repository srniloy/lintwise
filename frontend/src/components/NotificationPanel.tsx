import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Check, CheckCheck, BellOff, GitPullRequest, AlertTriangle, AtSign } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import type { Notification, NotificationType } from '@/types'

const TYPE_ICON: Record<NotificationType, ReactNode> = {
  REVIEW_COMPLETED: <GitPullRequest size={13} className="text-green-500" />,
  REVIEW_FAILED: <AlertTriangle size={13} className="text-orange-500" />,
  CRITICAL_ISSUE: <AlertTriangle size={13} className="text-destructive" />,
  MENTION: <AtSign size={13} className="text-blue-500" />,
  COMMENT_REPLY: <AtSign size={13} className="text-purple-500" />,
  TEAM_INVITE: <GitPullRequest size={13} className="text-indigo-500" />,
}

function notificationHref(n: Notification): string | null {
  if (!n.resourceId) return null
  if (n.resourceType === 'team' || n.type === 'TEAM_INVITE') return '/team'
  return `/review/${n.resourceId}`
}

interface Props {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onClose: () => void
}

export default function NotificationPanel({ notifications, onMarkRead, onMarkAllRead, onClose }: Props) {
  const navigate = useNavigate()
  const unread = notifications.filter((n) => !n.isRead).length

  function handleItemClick(n: Notification) {
    if (!n.isRead) onMarkRead(n.id)
    const href = notificationHref(n)
    if (href) {
      navigate(href)
      onClose()
    }
  }

  return (
    <div
      className={cn(
        'absolute right-0 top-11 z-20 w-80 rounded-md border border-border',
        'bg-popover shadow-lg overflow-hidden',
      )}
      role="dialog"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unread > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
        {unread > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="max-h-90 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <BellOff size={28} className="opacity-30" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <ul role="list">
            {notifications.map((n) => {
              const href = notificationHref(n)
              const isClickable = !!href || !n.isRead
              return (
                <li key={n.id} className="border-b border-border last:border-0">
                  <div
                    role={href ? 'button' : undefined}
                    tabIndex={href ? 0 : undefined}
                    onClick={() => handleItemClick(n)}
                    onKeyDown={(e) => {
                      if (href && (e.key === 'Enter' || e.key === ' ')) handleItemClick(n)
                    }}
                    className={cn(
                      'group relative flex items-start gap-3 px-3 py-3',
                      isClickable && 'cursor-pointer hover:bg-accent/50',
                      !n.isRead && 'bg-primary/5',
                    )}
                  >
                    {/* Unread indicator dot */}
                    {!n.isRead && (
                      <span className="absolute left-1.5 top-4.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}

                    {/* Type icon */}
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted ml-2">
                      {TYPE_ICON[n.type]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium leading-tight',
                        n.isRead ? 'text-muted-foreground' : 'text-foreground',
                      )}>
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground/60">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>

                    {/* Mark as read button (appears on hover) */}
                    {!n.isRead && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onMarkRead(n.id) }}
                        aria-label="Mark as read"
                        className={cn(
                          'shrink-0 mt-0.5 rounded-sm p-1',
                          'text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                          'opacity-0 group-hover:opacity-100',
                        )}
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
