import { useLocation, Link } from 'react-router-dom'
import { Bell, LogOut, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from './ThemeToggle'
import { cn } from '@/lib/utils'
import { useState } from 'react'

function useBreadcrumbs() {
  const { pathname } = useLocation()

  const segmentLabels: Record<string, string> = {
    dashboard: 'Dashboard',
    review: 'Reviews',
    new: 'New Review',
    status: 'Status',
    reviews: 'Reviews',
    snippets: 'Snippets',
    collections: 'Collections',
    profile: 'Profile',
    team: 'Team',
    admin: 'Admin',
  }

  const segments = pathname.split('/').filter(Boolean)
  return segments.map((seg, i) => ({
    label: segmentLabels[seg] ?? seg,
    path: '/' + segments.slice(0, i + 1).join('/'),
  }))
}

export default function Topbar() {
  const { user, logout } = useAuth()
  const breadcrumbs = useBreadcrumbs()
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, i) => (
            <li key={crumb.path} className="flex items-center gap-1">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {i === breadcrumbs.length - 1 ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
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

      {/* Right side actions */}
      <div className="flex items-center gap-1">
        {/* Notification bell — wired up in Step 18 */}
        <button
          aria-label="Notifications"
          className={cn(
            'relative flex h-9 w-9 items-center justify-center rounded-md',
            'text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <Bell size={18} />
        </button>

        <ThemeToggle />

        {/* User avatar / menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-label="User menu"
            aria-haspopup="true"
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
              <User size={16} />
            )}
          </button>

          {userMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setUserMenuOpen(false)}
              />
              {/* Dropdown */}
              <div
                className={cn(
                  'absolute right-0 top-11 z-20 w-52 rounded-md border border-border',
                  'bg-popover shadow-md',
                )}
              >
                {/* User info */}
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>

                <div className="p-1">
                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                      'text-foreground hover:bg-accent hover:text-accent-foreground',
                    )}
                  >
                    <User size={14} />
                    Profile
                  </Link>

                  <button
                    onClick={() => { void logout(); setUserMenuOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                      'text-destructive hover:bg-destructive/10',
                    )}
                  >
                    <LogOut size={14} />
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
