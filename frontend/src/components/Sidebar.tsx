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
  { label: 'Dashboard', to: ROUTES.DASHBOARD, icon: <LayoutDashboard size={18} /> },
  { label: 'New Review', to: ROUTES.REVIEW_NEW, icon: <FilePlus size={18} /> },
  { label: 'Reviews', to: ROUTES.REVIEWS, icon: <History size={18} /> },
  { label: 'Snippets', to: ROUTES.SNIPPETS, icon: <Code2 size={18} /> },
  { label: 'Collections', to: ROUTES.COLLECTIONS, icon: <FolderOpen size={18} /> },
  { label: 'Team', to: ROUTES.TEAM, icon: <Users size={18} />, premiumOnly: true },
  { label: 'Admin', to: ROUTES.ADMIN, icon: <ShieldCheck size={18} />, adminOnly: true },
  { label: 'Profile', to: ROUTES.PROFILE, icon: <User size={18} /> },
]

export default function Sidebar() {
  const { isAdmin, isPremium } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly) return isAdmin
    if (item.premiumOnly) return isPremium
    return true
  })

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-border bg-card',
        'transition-all duration-300',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <Zap size={20} className="shrink-0 text-primary" />
        {!collapsed && (
          <span className="ml-2 text-lg font-bold text-foreground">LintWise</span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {visibleItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                    'transition-colors duration-150',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    collapsed && 'justify-center px-2',
                  )
                }
                title={collapsed ? item.label : undefined}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'flex h-10 w-full items-center justify-center border-t border-border',
          'text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
        )}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  )
}
