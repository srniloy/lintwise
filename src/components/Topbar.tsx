import { useLocation, Link } from 'react-router-dom'
import { Bell, LogOut, User, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from './ThemeToggle'
import NotificationPanel from './NotificationPanel'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'

function useBreadcrumbs() {
  const { pathname } = useLocation()

  const segmentLabels: Record<string, string> = {
    dashboard:   'Dashboard',
    review:      'Reviews',
    new:         'New Review',
    status:      'Status',
    reviews:     'Reviews',
    snippets:    'Snippets',
    collections: 'Collections',
    profile:     'Profile',
    team:        'Team',
    admin:       'Admin',
  }

  const segments = pathname.split('/').filter(Boolean)
  return segments.map((seg, i) => ({
    label: segmentLabels[seg] ?? seg,
    path: '/' + segments.slice(0, i + 1).join('/'),
  }))
}

interface TopbarProps {
  onMobileMenuToggle: () => void
}

export default function Topbar({ onMobileMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth()
  const breadcrumbs = useBreadcrumbs()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()

  const userMenuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  // Close dropdowns on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setUserMenuOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4" role="banner">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={onMobileMenuToggle}
          aria-label="Open navigation menu"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md lg:hidden',
            'text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Menu size={18} aria-hidden="true" />
        </button>

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 text-sm" role="list">
            {breadcrumbs.map((crumb, i) => (
              <li key={crumb.path} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground" aria-hidden="true">/</span>}
                {i === breadcrumbs.length - 1 ? (
                  <span className="font-medium text-foreground" aria-current="page">{crumb.label}</span>
                ) : (
                  <Link
                    to={crumb.path}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-1" role="toolbar" aria-label="User tools">
        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            aria-haspopup="dialog"
            aria-expanded={notifOpen}
            onClick={() => { setNotifOpen((o) => !o); setUserMenuOpen(false) }}
            className={cn(
              'relative flex h-9 w-9 items-center justify-center rounded-md',
              'text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground leading-none"
                aria-hidden="true"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setNotifOpen(false)} />
              <NotificationPanel
                notifications={notifications}
                onMarkRead={(id) => void markRead(id)}
                onMarkAllRead={() => void markAllRead()}
                onClose={() => setNotifOpen(false)}
              />
            </>
          )}
        </div>

        <ThemeToggle />

        {/* User avatar / menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-label={`User menu for ${user?.name ?? 'user'}`}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full',
              'overflow-hidden border-2 border-border bg-muted',
              'text-muted-foreground transition-colors hover:border-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              <User size={16} aria-hidden="true" />
            )}
          </button>

          {userMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                aria-hidden="true"
                onClick={() => setUserMenuOpen(false)}
              />
              {/* Dropdown */}
              <div
                role="menu"
                aria-label="User menu"
                className={cn(
                  'absolute right-0 top-11 z-20 w-52 rounded-md border border-border',
                  'bg-popover shadow-md',
                )}
              >
                {/* User info */}
                <div className="px-3 py-2 border-b border-border" role="presentation">
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>

                <div className="p-1" role="presentation">
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                      'text-foreground hover:bg-accent hover:text-accent-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <User size={14} aria-hidden="true" />
                    Profile
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { void logout(); setUserMenuOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                      'text-destructive hover:bg-destructive/10',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    <LogOut size={14} aria-hidden="true" />
                    Logout
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
