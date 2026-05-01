import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Database,
  Gauge,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  Users,
  UserX,
  UserCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { adminService } from '@/services/adminService'
import type {
  AdminUser,
  AdminUsersQuery,
  PlatformStats,
  RateLimitMonitor,
  ServiceHealth,
  ServiceStatus,
  SystemHealth,
} from '@/services/adminService'
import type { PaginatedResponse, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
} from '@/components/ui/modal'
import { cn } from '@/lib/utils'

// ── Types & helpers ──────────────────────────────────────────────────────────

type RoleFilter = UserRole | 'ALL'

const ROLE_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'ALL', label: 'All roles' },
  { value: 'USER', label: 'User' },
  { value: 'PREMIUM', label: 'Premium' },
  { value: 'ADMIN', label: 'Admin' },
]

const ROLE_BADGE: Record<UserRole, 'info' | 'default' | 'critical'> = {
  USER: 'info',
  PREMIUM: 'default',
  ADMIN: 'critical',
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message
    if (typeof m === 'string' && m.length) return m
  }
  return fallback
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ShieldCheck size={22} className="text-primary" />
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide controls and monitoring. Signed in as{' '}
            <span className="font-medium text-foreground">{user?.email}</span>.
          </p>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="h-9">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="health">System Health</TabsTrigger>
          <TabsTrigger value="stats">Review Stats</TabsTrigger>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement currentUserId={user?.id} />
        </TabsContent>

        <TabsContent value="health">
          <SystemHealthSection />
        </TabsContent>

        <TabsContent value="stats">
          <ReviewStatsSection />
        </TabsContent>

        <TabsContent value="rate-limits">
          <RateLimitSection />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── User Management ──────────────────────────────────────────────────────────

function UserManagement({ currentUserId }: { currentUserId?: string }) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [role, setRole] = useState<RoleFilter>('ALL')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PaginatedResponse<AdminUser> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null)
  const [roleDraft, setRoleDraft] = useState<UserRole>('USER')
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [actionBusyId, setActionBusyId] = useState<string | null>(null)

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const query: AdminUsersQuery = {
        search: debouncedSearch || undefined,
        role,
        page,
        limit: 20,
      }
      const res = await adminService.listUsers(query)
      setData(res)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load users'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, role, page])

  useEffect(() => { void load() }, [load])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [debouncedSearch, role])

  async function handleRoleChange() {
    if (!roleTarget || roleDraft === roleTarget.role) {
      setRoleTarget(null)
      return
    }
    setActionBusyId(roleTarget.id)
    try {
      await adminService.updateUserRole(roleTarget.id, roleDraft)
      toast.success(`${roleTarget.name}'s role updated to ${roleDraft.toLowerCase()}`)
      setRoleTarget(null)
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update role'))
    } finally {
      setActionBusyId(null)
    }
  }

  async function handleSuspendToggle(u: AdminUser) {
    setActionBusyId(u.id)
    try {
      if (u.isSuspended) {
        await adminService.unsuspendUser(u.id)
        toast.success(`${u.name} reinstated`)
      } else {
        await adminService.suspendUser(u.id)
        toast.success(`${u.name} suspended`)
      }
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Action failed'))
    } finally {
      setActionBusyId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setActionBusyId(deleteTarget.id)
    try {
      await adminService.deleteUser(deleteTarget.id)
      toast.success(`${deleteTarget.name} deleted`)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to delete user'))
    } finally {
      setActionBusyId(null)
    }
  }

  const users = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users size={16} className="text-muted-foreground" />
            User Management
            {data && (
              <span className="text-xs font-normal text-muted-foreground">
                ({data.total.toLocaleString()})
              </span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} />
            Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="w-44">
            <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <ErrorBlock message={error} onRetry={() => void load()} />
        ) : loading && !data ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No users match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Role</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Joined</th>
                  <th className="px-4 py-2 text-left font-medium">Last login</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => {
                  const busy = actionBusyId === u.id
                  const isSelf = u.id === currentUserId
                  return (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {u.name}
                              {isSelf && (
                                <span className="ml-1.5 text-[10px] text-muted-foreground">
                                  (you)
                                </span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ROLE_BADGE[u.role]} className="capitalize">
                          {u.role.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {u.isSuspended ? (
                          <Badge variant="critical">Suspended</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(u.lastLoginAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            disabled={busy || isSelf}
                            onClick={() => {
                              setRoleDraft(u.role)
                              setRoleTarget(u)
                            }}
                            title="Change role"
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <UserCog size={14} />
                          </button>
                          <button
                            disabled={busy || isSelf}
                            onClick={() => void handleSuspendToggle(u)}
                            title={u.isSuspended ? 'Reinstate user' : 'Suspend user'}
                            className={cn(
                              'rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                              u.isSuspended
                                ? 'text-green-600 hover:bg-green-500/10 dark:text-green-400'
                                : 'text-yellow-600 hover:bg-yellow-500/10 dark:text-yellow-400',
                            )}
                          >
                            {u.isSuspended ? <UserCheck size={14} /> : <UserX size={14} />}
                          </button>
                          <button
                            disabled={busy || isSelf}
                            onClick={() => setDeleteTarget(u)}
                            title="Delete account"
                            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Page {data.page} of {totalPages} · {data.total.toLocaleString()} total
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={14} />
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Change role modal */}
      <Modal open={!!roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Change Role</ModalTitle>
            <ModalDescription>
              Update role for{' '}
              <strong className="font-semibold text-foreground">{roleTarget?.name}</strong>.
              This change takes effect immediately.
            </ModalDescription>
          </ModalHeader>
          <div className="px-6 pb-2">
            <Select value={roleDraft} onValueChange={(v) => setRoleDraft(v as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="PREMIUM">Premium</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline">Cancel</Button>
            </ModalClose>
            <Button
              onClick={() => void handleRoleChange()}
              loading={actionBusyId === roleTarget?.id}
              disabled={!roleTarget || roleDraft === roleTarget.role}
            >
              Save Role
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete user modal */}
      <Modal open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Delete Account</ModalTitle>
            <ModalDescription>
              Permanently delete{' '}
              <strong className="font-semibold text-foreground">{deleteTarget?.name}</strong>{' '}
              ({deleteTarget?.email})? This will erase all their reviews, snippets, and team
              memberships. This action cannot be undone.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline">Cancel</Button>
            </ModalClose>
            <Button
              variant="danger"
              onClick={() => void handleDelete()}
              loading={actionBusyId === deleteTarget?.id}
            >
              Delete Account
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}

// ── System Health (FR8.1) ────────────────────────────────────────────────────

function SystemHealthSection() {
  const [data, setData] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await adminService.getSystemHealth())
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load system health'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 15_000)
    return () => clearInterval(id)
  }, [load])

  if (loading && !data) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorBlock message={error} onRetry={() => void load()} />
  }

  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <ServiceTile name="Database" Icon={Database} service={data.database} />
        <ServiceTile name="Redis Cache" Icon={Sparkles} service={data.redis} />
        <ServiceTile name="Gemini API" Icon={Activity} service={data.gemini} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
          <div className="flex items-center gap-2">
            <Gauge size={14} className="text-muted-foreground" />
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-medium text-foreground">
              {formatUptime(data.uptimeSeconds)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw size={12} />
            Auto-refreshing every 15s · Last check {new Date(data.checkedAt).toLocaleTimeString()}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const STATUS_META: Record<ServiceStatus, { label: string; tone: string; Icon: typeof CircleCheck }> = {
  UP:       { label: 'Operational', tone: 'text-green-600 dark:text-green-400', Icon: CircleCheck },
  DEGRADED: { label: 'Degraded',    tone: 'text-yellow-600 dark:text-yellow-400', Icon: AlertTriangle },
  DOWN:     { label: 'Down',        tone: 'text-red-600 dark:text-red-400', Icon: CircleX },
}

function ServiceTile({
  name,
  Icon,
  service,
}: {
  name: string
  Icon: React.ComponentType<{ size?: number; className?: string }>
  service: ServiceHealth
}) {
  const meta = STATUS_META[service.status]
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon size={16} className="text-muted-foreground" />
            <span className="font-medium text-foreground">{name}</span>
          </div>
          <span className={cn('flex items-center gap-1 text-xs font-medium', meta.tone)}>
            <meta.Icon size={14} />
            {meta.label}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Latency</p>
            <p className="font-medium text-foreground">
              {typeof service.latencyMs === 'number' ? `${service.latencyMs} ms` : '—'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Detail</p>
            <p className="truncate font-medium text-foreground" title={service.message}>
              {service.message ?? 'OK'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Review Stats ─────────────────────────────────────────────────────────────

function ReviewStatsSection() {
  const [data, setData] = useState<PlatformStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await adminService.getPlatformStats())
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load platform stats'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading && !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />
  if (!data) return null

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total users" value={data.totalUsers.toLocaleString()} />
        <StatTile
          label="Active users today"
          value={data.activeUsersToday.toLocaleString()}
          hint={`${data.activeUsers7d.toLocaleString()} in last 7d`}
        />
        <StatTile label="Total reviews" value={data.totalReviews.toLocaleString()} />
        <StatTile
          label="Reviews today"
          value={data.reviewsToday.toLocaleString()}
          hint={`${data.reviews7d.toLocaleString()} in last 7d`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Reviews — last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyReviewsChart points={data.dailyReviews} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <StatusRow label="Completed" value={data.reviewsByStatus.COMPLETED} tone="success" />
            <StatusRow label="Processing" value={data.reviewsByStatus.PROCESSING} tone="info" />
            <StatusRow label="Pending" value={data.reviewsByStatus.PENDING} tone="muted" />
            <StatusRow label="Failed" value={data.reviewsByStatus.FAILED} tone="critical" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'success' | 'info' | 'muted' | 'critical'
}) {
  const dot: Record<typeof tone, string> = {
    success:  'bg-green-500',
    info:     'bg-blue-500',
    muted:    'bg-muted-foreground/40',
    critical: 'bg-destructive',
  }
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <span className="flex items-center gap-2 text-foreground">
        <span className={cn('h-2 w-2 rounded-full', dot[tone])} />
        {label}
      </span>
      <span className="font-medium text-foreground">{value.toLocaleString()}</span>
    </div>
  )
}

function DailyReviewsChart({ points }: { points: { date: string; count: number }[] }) {
  if (!points || points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No review activity in this period.
      </p>
    )
  }

  const max = Math.max(...points.map((p) => p.count), 1)

  return (
    <div className="space-y-3">
      <div className="flex h-40 items-end gap-1">
        {points.map((p) => {
          const heightPct = Math.max(2, (p.count / max) * 100)
          return (
            <div
              key={p.date}
              title={`${new Date(p.date).toLocaleDateString()} — ${p.count} reviews`}
              className="group relative flex-1 rounded-t-sm bg-primary/30 transition-colors hover:bg-primary"
              style={{ height: `${heightPct}%` }}
            >
              <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-1.5 py-0.5 text-[10px] text-popover-foreground opacity-0 shadow-sm group-hover:opacity-100">
                {p.count}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{new Date(points[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        <span>Peak: {max.toLocaleString()}</span>
        <span>{new Date(points[points.length - 1].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </div>
    </div>
  )
}

// ── Rate Limit Monitor ───────────────────────────────────────────────────────

function RateLimitSection() {
  const [data, setData] = useState<RateLimitMonitor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await adminService.getRateLimitMonitor())
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load rate limit data'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 30_000)
    return () => clearInterval(id)
  }, [load])

  const sortedTopUsers = useMemo(() => {
    if (!data?.topUsers) return []
    return [...data.topUsers].sort((a, b) => b.utilization - a.utilization).slice(0, 10)
  }, [data])

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />
  if (!data) return null

  return (
    <div className="space-y-4">
      {/* Per-tier usage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Usage by tier</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {data.tiers.map((t) => {
            const pct = Math.min(100, Math.round(t.utilization * 100))
            return (
              <div key={t.tier} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <Badge variant={ROLE_BADGE[t.tier]} className="capitalize">
                    {t.tier.toLowerCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    per {Math.round(t.windowSeconds / 60)} min
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-lg font-semibold text-foreground">
                    {t.used.toLocaleString()} / {t.limit.toLocaleString()}
                  </span>
                  <span className={cn(
                    'text-xs font-medium',
                    pct >= 90 ? 'text-destructive' : pct >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground',
                  )}>
                    {pct}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full transition-all',
                      pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-yellow-500' : 'bg-primary',
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Top users */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Top consumers</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void load()}>
              <RefreshCw size={14} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sortedTopUsers.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              No rate-limit activity recorded.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">User</th>
                  <th className="px-4 py-2 text-left font-medium">Tier</th>
                  <th className="px-4 py-2 text-left font-medium">Usage</th>
                  <th className="px-4 py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedTopUsers.map((u) => {
                  const pct = Math.min(100, Math.round(u.utilization * 100))
                  return (
                    <tr key={u.userId}>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={ROLE_BADGE[u.role]} className="capitalize">
                          {u.role.toLowerCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-foreground">
                        {u.used.toLocaleString()} / {u.limit.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className={cn(
                          'font-medium',
                          pct >= 90 ? 'text-destructive' : pct >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground',
                        )}>
                          {pct}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Shared error state ───────────────────────────────────────────────────────

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-12 text-center">
      <AlertTriangle size={28} className="text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw size={14} />
        Try again
      </Button>
    </div>
  )
}

// Suppress unused-warning for Spinner if not referenced (kept for parity with other pages)
void Spinner
