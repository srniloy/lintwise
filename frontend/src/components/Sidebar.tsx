import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FilePlus,
  History,
  Code2,
  FolderOpen,
  Users,
  ShieldCheck,
  User,
  ChevronLeft,
  ChevronRight,
  Zap,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
  premiumOnly?: boolean
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard',   to: ROUTES.DASHBOARD,   icon: <LayoutDashboard size={18} /> },
  { label: 'New Review',  to: ROUTES.REVIEW_NEW,  icon: <FilePlus size={18} /> },
  { label: 'Reviews',     to: ROUTES.REVIEWS,     icon: <History size={18} /> },
  { label: 'Snippets',    to: ROUTES.SNIPPETS,    icon: <Code2 size={18} /> },
  { label: 'Collections', to: ROUTES.COLLECTIONS, icon: <FolderOpen size={18} /> },
  { label: 'Team',        to: ROUTES.TEAM,        icon: <Users size={18} />, premiumOnly: true },
  { label: 'Admin',       to: ROUTES.ADMIN,       icon: <ShieldCheck size={18} />, adminOnly: true },
  { label: 'Profile',     to: ROUTES.PROFILE,     icon: <User size={18} /> },
]

interface SidebarProps {
  mobileSidebarOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ mobileSidebarOpen, onMobileClose }: SidebarProps) {
  const { isAdmin, isPremium } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly) return isAdmin
    if (item.premiumOnly) return isPremium
    return true
  })

  const sidebarContent = (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-border bg-card',
        'transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Zap size={20} className="shrink-0 text-primary" aria-hidden="true" />
          {!collapsed && (
            <span className="text-lg font-bold text-foreground">LintWise</span>
          )}
        </div>
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          aria-label="Close navigation"
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md lg:hidden',
            'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <X size={16} />
        </button>
      </div>

      {/* Nav items */}
      <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1" role="list">
          {visibleItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                    'transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    collapsed && 'justify-center px-2',
                  )
                }
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
              >
                <span className="shrink-0" aria-hidden="true">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse toggle (desktop only) */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'hidden h-10 w-full items-center justify-center border-t border-border lg:flex',
          'text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        )}
      >
        {collapsed
          ? <ChevronRight size={16} aria-hidden="true" />
          : <ChevronLeft size={16} aria-hidden="true" />
        }
      </button>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        {sidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-hidden="true"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 flex h-full lg:hidden">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}
