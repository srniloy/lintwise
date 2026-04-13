import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, Circle, AlertTriangle, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { authService } from '@/services/authService'
import { ROUTES } from '@/constants/routes'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Password strength (same helpers as RegisterPage) ─────────────────────────

interface PasswordRule {
  label: string
  test: (pw: string) => boolean
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'Uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'Lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'Number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'Special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

function getStrengthScore(password: string): number {
  if (!password) return 0
  return PASSWORD_RULES.filter((r) => r.test(password)).length
}

const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-green-500']
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Strong']

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isExpired, setIsExpired] = useState(false)

  const strengthScore = getStrengthScore(newPassword)

  // No token in URL → show invalid link message immediately
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Invalid reset link</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This password reset link is invalid or missing. Please request a new one.
            </p>
            <Link to={ROUTES.FORGOT_PASSWORD}>
              <Button className="w-full">Request New Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Expired / used token (set after API error)
  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-destructive/10 p-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Link expired</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This password reset link has expired or has already been used. Please request a new one.
            </p>
            <Link to={ROUTES.FORGOT_PASSWORD}>
              <Button className="w-full">Request New Link</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const newErrors: typeof errors = {}

    if (!newPassword) {
      newErrors.newPassword = 'New password is required'
    } else if (getStrengthScore(newPassword) < 5) {
      newErrors.newPassword = 'Password must meet all requirements'
    }
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password'
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})

    setIsLoading(true)
    try {
      await authService.resetPassword(token as string, newPassword)
      toast.success('Password updated successfully!')
      navigate(ROUTES.LOGIN)
    } catch (err: unknown) {
      const apiErr = err as { message?: string; statusCode?: number }
      if (apiErr?.statusCode === 400 || apiErr?.message?.toLowerCase().includes('expir')) {
        setIsExpired(true)
      } else {
        toast.error(apiErr?.message ?? 'Failed to reset password. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Set new password</CardTitle>
          <CardDescription>Choose a strong password for your account.</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <Input
                label="New Password"
                type="password"
                placeholder="Create a new password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setErrors((p) => ({ ...p, newPassword: undefined })) }}
                error={errors.newPassword}
                autoComplete="new-password"
                autoFocus
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
              placeholder="Repeat your new password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: undefined })) }}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full" size="lg" loading={isLoading}>
              Update Password
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <Link
            to={ROUTES.LOGIN}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
