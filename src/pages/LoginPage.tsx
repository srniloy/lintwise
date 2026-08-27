import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AlertCircle, User, ShieldCheck, Crown, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// ─── Quick demo logins (auto-login) ───────────────────────────────────────────
const DEMO_USERS = [
  { label: 'Premium User', email: 'john@gmail.com', password: 'Ab@112233', icon: Crown },
  { label: 'Regular User', email: 'jane@gmail.com', password: 'Ab@112233', icon: User },
  { label: 'Admin', email: 'admin@gmail.com', password: 'Ab@112233', icon: ShieldCheck },
] as const

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? ROUTES.DASHBOARD

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [quickLoading, setQuickLoading] = useState<string | null>(null)

  // Lockout state
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isLocked = lockedUntil !== null && countdown > 0

  async function quickLogin(email: string, password: string) {
    if (isLocked) return
    setQuickLoading(email)
    try {
      await login({ email, password, rememberMe: true })
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Quick login failed. Please try again.')
    } finally {
      setQuickLoading(null)
    }
  }

  // Countdown ticker
  useEffect(() => {
    if (!lockedUntil) return

    function tick() {
      const remaining = lockedUntil!.getTime() - Date.now()
      if (remaining <= 0) {
        setLockedUntil(null)
        setFailedAttempts(0)
        setCountdown(0)
        if (intervalRef.current) clearInterval(intervalRef.current)
      } else {
        setCountdown(remaining)
      }
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [lockedUntil])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLocked) return

    if (!email.trim()) { setFieldError('Email is required'); return }
    if (!password) { setFieldError('Password is required'); return }
    setFieldError(null)

    setIsLoading(true)
    try {
      await login({ email, password, rememberMe })
      toast.success('Welcome back!')
      navigate(from, { replace: true })
    } catch (err: unknown) {
      const apiErr = err as { message?: string; statusCode?: number }
      const nextAttempts = failedAttempts + 1
      setFailedAttempts(nextAttempts)

      if (nextAttempts >= MAX_ATTEMPTS) {
        const lockEnd = new Date(Date.now() + LOCKOUT_DURATION_MS)
        setLockedUntil(lockEnd)
        setFieldError(null)
        toast.error('Too many failed attempts. Account temporarily locked.')
      } else {
        const remaining = MAX_ATTEMPTS - nextAttempts
        setFieldError(
          apiErr?.message ?? `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        )
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-xl">
        <Link
          to={ROUTES.HOME}
          className="flex items-center gap-1.5 px-6 pt-6 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>Sign in to your LintWise account</CardDescription>
        </CardHeader>

        <CardContent>
          {/* Quick demo login (auto-login) */}
          <div className="mb-6 space-y-3">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quick Demo Login
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DEMO_USERS.map((cred) => {
                const Icon = cred.icon
                const loading = quickLoading === cred.email
                return (
                  <button
                    key={cred.email}
                    type="button"
                    disabled={isLocked || quickLoading !== null}
                    onClick={() => quickLogin(cred.email, cred.password)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2.5',
                      'text-left transition-colors hover:border-primary/40 hover:bg-accent',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      'disabled:pointer-events-none disabled:opacity-50',
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      {loading ? (
                        <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{cred.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{cred.email}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          {/* Lockout banner */}
          {isLocked && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Account temporarily locked</p>
                <p className="text-muted-foreground">
                  Too many failed attempts. Try again in{' '}
                  <span className="font-mono font-semibold text-foreground">{formatCountdown(countdown)}</span>.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldError(null) }}
              disabled={isLocked}
              autoComplete="email"
              autoFocus
            />

            <div className="space-y-1">
              <Input
                label="Password"
                type="password"
                placeholder="Your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldError(null) }}
                error={fieldError ?? undefined}
                disabled={isLocked}
                autoComplete="current-password"
              />
            </div>

            {/* Remember me + forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className={cn(
                    'h-4 w-4 rounded border border-input accent-primary',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                />
                <span className="text-sm text-muted-foreground">Remember me</span>
              </label>

              <Link
                to={ROUTES.FORGOT_PASSWORD}
                className="text-sm text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              loading={isLoading}
              disabled={isLocked}
            >
              Sign In
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to={ROUTES.REGISTER} className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
