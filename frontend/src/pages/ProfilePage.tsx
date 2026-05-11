import { useState, useEffect } from 'react'
import { CheckCircle, Circle, Trash2, User, Lock, Bell, AlertTriangle, Crown, Sparkles, FileText, Download } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/authService'
import { notificationService } from '@/services/notificationService'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'
import { api } from '@/services/apiClient'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { saveBlobAs } from '@/lib/download'
import type { User as UserType, NotificationPreferences } from '@/types'

// ─── Password strength helpers ────────────────────────────────────────────────

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { label: 'Uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter', test: (pw: string) => /[a-z]/.test(pw) },
  { label: 'Number', test: (pw: string) => /[0-9]/.test(pw) },
  { label: 'Special character', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
]

function getStrengthScore(pw: string) {
  return pw ? PASSWORD_RULES.filter((r) => r.test(pw)).length : 0
}

const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-500']
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Strong']

// ─── Role badge variant ───────────────────────────────────────────────────────

function roleBadgeVariant(role: string) {
  if (role === 'ADMIN') return 'critical' as const
  if (role === 'PREMIUM') return 'success' as const
  return 'info' as const
}

// ─── Tab: Personal Info ───────────────────────────────────────────────────────

function PersonalInfoTab({ profile }: { profile: UserType }) {
  const setUser = useAuthStore((s) => s.setUser)
  const [name, setName] = useState(profile.name)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? '')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name cannot be empty'); return }
    setIsLoading(true)
    try {
      const updated = await authService.updateProfile({ name: name.trim(), avatarUrl: avatarUrl || undefined })
      setUser(updated)
      toast.success('Profile updated successfully')
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Personal Information</CardTitle>
        <CardDescription>Update your name and avatar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Email</label>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                value={profile.email}
                disabled
                className="flex-1 opacity-70"
              />
              <Badge variant={roleBadgeVariant(profile.role)} className="shrink-0">
                {profile.role}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
          </div>

          <Input
            label="Avatar URL"
            type="url"
            placeholder="https://example.com/avatar.png"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            helperText="Link to your profile picture"
          />

          <div className="flex justify-end">
            <Button type="submit" loading={isLoading}>Save Changes</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Change Password ─────────────────────────────────────────────────────

function ChangePasswordTab() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ current?: string; new?: string; confirm?: string }>({})
  const [isLoading, setIsLoading] = useState(false)

  const strengthScore = getStrengthScore(newPassword)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: typeof errors = {}
    if (!currentPassword) newErrors.current = 'Current password is required'
    if (!newPassword) {
      newErrors.new = 'New password is required'
    } else if (getStrengthScore(newPassword) < 5) {
      newErrors.new = 'Password must meet all requirements'
    }
    if (!confirmPassword) {
      newErrors.confirm = 'Please confirm your new password'
    } else if (newPassword !== confirmPassword) {
      newErrors.confirm = 'Passwords do not match'
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})
    setIsLoading(true)

    try {
      await authService.changePassword(currentPassword, newPassword)
      toast.success('Password changed successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const apiErr = err as { message?: string; statusCode?: number }
      if (apiErr?.statusCode === 400 || apiErr?.message?.toLowerCase().includes('current')) {
        setErrors({ current: 'Current password is incorrect' })
      } else {
        toast.error(apiErr?.message ?? 'Failed to change password')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Change Password</CardTitle>
        <CardDescription>Update your password to keep your account secure.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input
            label="Current Password"
            type="password"
            value={currentPassword}
            onChange={(e) => { setCurrentPassword(e.target.value); setErrors((p) => ({ ...p, current: undefined })) }}
            error={errors.current}
            autoComplete="current-password"
          />

          <div className="space-y-2">
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setErrors((p) => ({ ...p, new: undefined })) }}
              error={errors.new}
              autoComplete="new-password"
            />

            {newPassword && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors duration-300',
                        i <= strengthScore ? STRENGTH_COLORS[strengthScore] : 'bg-muted',
                      )}
                    />
                  ))}
                  <span className="ml-2 text-xs text-muted-foreground w-12 text-right">
                    {STRENGTH_LABELS[strengthScore]}
                  </span>
                </div>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(newPassword)
                    return (
                      <li key={rule.label} className="flex items-center gap-1.5 text-xs">
                        {met ? (
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className={met ? 'text-foreground' : 'text-muted-foreground'}>
                          {rule.label}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirm: undefined })) }}
            error={errors.confirm}
            autoComplete="new-password"
          />

          <div className="flex justify-end">
            <Button type="submit" loading={isLoading}>Update Password</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

// ─── Tab: Notification Preferences ───────────────────────────────────────────

const NOTIFICATION_PREF_META: { id: keyof NotificationPreferences; label: string; description: string }[] = [
  { id: 'review_complete', label: 'Review complete', description: 'Notify when a code review finishes processing.' },
  { id: 'critical_issues', label: 'Critical issues found', description: 'Alert when critical severity issues are detected.' },
  { id: 'team_mentions', label: 'Team mentions', description: 'Notify when a teammate @mentions you in a comment.' },
]

function NotificationPrefsTab() {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    review_complete: true,
    critical_issues: true,
    team_mentions: false,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState<keyof NotificationPreferences | null>(null)

  useEffect(() => {
    notificationService.getPreferences()
      .then((data) => setPrefs(data))
      .catch(() => { /* keep defaults on failure */ })
      .finally(() => setIsLoading(false))
  }, [])

  async function toggle(id: keyof NotificationPreferences) {
    const next = { ...prefs, [id]: !prefs[id] }
    setPrefs(next)
    setSaving(id)
    try {
      const updated = await notificationService.updatePreferences({ [id]: next[id] })
      setPrefs(updated)
      toast.success('Preferences saved')
    } catch (err: unknown) {
      setPrefs(prefs)
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to save preferences')
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Notification Preferences</CardTitle>
        <CardDescription>Choose which notifications you want to receive.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : (
          NOTIFICATION_PREF_META.map((pref) => (
            <div key={pref.id} className="flex items-start justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{pref.label}</p>
                <p className="text-xs text-muted-foreground">{pref.description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={prefs[pref.id]}
                disabled={saving === pref.id}
                onClick={() => void toggle(pref.id)}
                className={cn(
                  'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent',
                  'transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  prefs[pref.id] ? 'bg-primary' : 'bg-muted',
                  saving === pref.id && 'opacity-60 cursor-not-allowed',
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform duration-200',
                    prefs[pref.id] ? 'translate-x-5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

// ─── Tab: Danger Zone ─────────────────────────────────────────────────────────

function DangerZoneTab() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleDelete() {
    if (confirmText !== 'DELETE') return
    setIsLoading(true)
    try {
      await api.delete('/users/me')
      clearAuth()
      toast.success('Account deleted. We\'re sorry to see you go.')
      navigate(ROUTES.LOGIN, { replace: true })
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to delete account. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
        <CardDescription>Irreversible actions that affect your account permanently.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Delete account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => setOpen(true)} className="shrink-0">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardContent>

      <Modal open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText('') }}>
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <ModalTitle>Delete your account?</ModalTitle>
            </div>
            <ModalDescription>
              This will permanently delete your account, all your reviews, snippets, and data.
              This action <strong>cannot be undone</strong>.
            </ModalDescription>
          </ModalHeader>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className={cn(
                'w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'placeholder:text-muted-foreground',
              )}
            />
          </div>

          <ModalFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setConfirmText('') }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirmText !== 'DELETE' || isLoading}
              loading={isLoading}
              onClick={handleDelete}
            >
              Delete Account
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Card>
  )
}

// ─── Tab: Plan ────────────────────────────────────────────────────────────────

interface Invoice {
  id: string
  amount: number
  currency: string
  status: 'paid' | 'pending' | 'failed'
  date: string
  description: string
}

function PlanTab({ profile }: { profile: UserType }) {
  const setUser = useAuthStore((s) => s.setUser)
  const isPremium = profile.role === 'PREMIUM' || profile.role === 'ADMIN'
  const isScheduledForCancel = profile.cancelAtPeriodEnd === true
  const [cancelling, setCancelling] = useState(false)
  const [resubscribing, setResubscribing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [invoicesLoading, setInvoicesLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  useEffect(() => {
    if (!isPremium) return
    setInvoicesLoading(true)
    api.get<Invoice[]>('/subscriptions/invoices', { cache: true })
      .then(setInvoices)
      .catch(() => { /* silent */ })
      .finally(() => setInvoicesLoading(false))
  }, [isPremium])

  async function handleCancel() {
    setCancelling(true)
    try {
      const data = await api.post<{
        message: string
        subscriptionEndDate: string
        user: UserType
      }>('/subscriptions/cancel')
      setUser(data.user)
      toast.success(data.message)
      window.location.reload()
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to cancel subscription. Please try again.')
    } finally {
      setCancelling(false)
      setConfirmOpen(false)
    }
  }

  async function handleResubscribe() {
    setResubscribing(true)
    try {
      const data = await api.post<{ message: string; user: UserType }>('/subscriptions/resubscribe')
      setUser(data.user)
      toast.success(data.message)
      window.location.reload()
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to resubscribe. Please try again.')
    } finally {
      setResubscribing(false)
    }
  }

  async function handleDownload(invoiceId: string) {
    setDownloadingId(invoiceId)
    try {
      const { blob, filename } = await api.download(`/subscriptions/invoices/${invoiceId}/pdf`)
      saveBlobAs(blob, filename)
      toast.success('Invoice downloaded')
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Failed to download invoice')
    } finally {
      setDownloadingId(null)
    }
  }

  if (!isPremium) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Free Plan
          </CardTitle>
          <CardDescription>You are currently on the Free plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upgrade to Premium to unlock unlimited reviews, team collaboration, priority support, and more.
          </p>
          <Button onClick={() => window.location.href = ROUTES.UPGRADE} className="gap-2">
            <Crown className="h-4 w-4" />
            Upgrade to Premium
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-primary" />
            Premium Plan
          </CardTitle>
          <CardDescription>You are on the Premium plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Plan</span>
              <Badge variant="success">Premium</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Billing</span>
              <span className="text-sm text-foreground">$20 / year</span>
            </div>
            {profile.role === 'PREMIUM' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="success">Active</Badge>
              </div>
            )}
          </div>

          {profile.role === 'PREMIUM' && !isScheduledForCancel && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
              <p className="text-sm font-medium text-destructive">Cancel Subscription</p>
              <p className="text-xs text-muted-foreground">
                Your premium features will remain active until the end of the current billing period, after which your account will revert to the Free plan.
              </p>
              <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
                Cancel Subscription
              </Button>
            </div>
          )}

          {profile.role === 'PREMIUM' && isScheduledForCancel && (
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Cancellation Scheduled</p>
              <p className="text-xs text-muted-foreground">
                {profile.subscriptionEndDate ? (
                  <>Your premium access ends on{' '}
                    <span className="font-medium text-foreground">
                      {new Date(profile.subscriptionEndDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>. After this date your account will revert to the Free plan.</>
                ) : (
                  'Your premium features will remain active until the end of the current billing period, after which your account will revert to the Free plan.'
                )}
              </p>
              <Button variant="outline" size="sm" loading={resubscribing} onClick={handleResubscribe}>
                Resubscribe
              </Button>
            </div>
          )}

          {profile.role === 'ADMIN' && (
            <p className="text-xs text-muted-foreground">
              Administrators automatically have premium access.
            </p>
          )}
        </CardContent>

        <Modal open={confirmOpen} onOpenChange={setConfirmOpen}>
          <ModalContent>
            <ModalHeader>
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <ModalTitle>Cancel Subscription?</ModalTitle>
              </div>
              <ModalDescription>
                Your premium features will remain active until the end of the current billing period, after which your account will revert to the Free plan. This action can be undone by resubscribing before the end date.
              </ModalDescription>
            </ModalHeader>
            <ModalFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Keep Subscription
              </Button>
              <Button variant="danger" loading={cancelling} onClick={handleCancel}>
                Yes, Cancel Subscription
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Invoices
          </CardTitle>
          <CardDescription>View and download your payment receipts.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No invoices yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">{inv.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{new Date(inv.date).toLocaleDateString()}</span>
                      <span>·</span>
                      <span>{inv.currency.toUpperCase()} {inv.amount.toFixed(2)}</span>
                      <span>·</span>
                      <Badge
                        variant={
                          inv.status === 'paid' ? 'success' :
                            inv.status === 'pending' ? 'medium' : 'critical'
                        }
                        className="capitalize"
                      >
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={downloadingId === inv.id}
                    onClick={() => handleDownload(inv.id)}
                    aria-label={`Download invoice for ${inv.description}`}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const setUser = useAuthStore((s) => s.setUser)
  const [profile, setProfile] = useState<UserType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isPremium = profile?.role === 'PREMIUM' || profile?.role === 'ADMIN'

  useEffect(() => {
    authService.getProfile()
      .then((data) => {
        setProfile(data)
        setUser(data)
      })
      .catch(() => {
        const fallback = useAuthStore.getState().user
        if (fallback) setProfile(fallback)
        else toast.error('Failed to load profile')
      })
      .finally(() => setIsLoading(false))
  }, [setUser])

  if (isLoading) {
    return (
      <div className="p-8 w-full max-w-480 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Could not load profile. Please refresh.
      </div>
    )
  }

  return (
    <div className="p-8 w-full max-w-480 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account information and preferences.</p>
      </div>

      <Tabs defaultValue="personal">
        <TabsList className="w-full justify-start overflow-x-auto space-x-2">
          <TabsTrigger value="personal" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            Personal Info
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Password
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </TabsTrigger>
          {isPremium && (
            <TabsTrigger value="plan" className="flex items-center gap-1.5">
              <Crown className="h-3.5 w-3.5" />
              Plan
            </TabsTrigger>
          )}
          <TabsTrigger value="danger" className="flex items-center gap-1.5 text-destructive data-[state=active]:text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Danger Zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <PersonalInfoTab profile={profile} />
        </TabsContent>

        <TabsContent value="password">
          <ChangePasswordTab />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPrefsTab />
        </TabsContent>

        {isPremium && (
          <TabsContent value="plan">
            <PlanTab profile={profile} />
          </TabsContent>
        )}

        <TabsContent value="danger">
          <DangerZoneTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
