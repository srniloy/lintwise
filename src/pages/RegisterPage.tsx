import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, Circle, Mail, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { ROUTES } from '@/constants/routes'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Password strength helpers ────────────────────────────────────────────────

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

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Strong']
const STRENGTH_COLORS = [
  '',
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-green-500',
]

// ─── Validation ───────────────────────────────────────────────────────────────

interface FormErrors {
  name?: string
  email?: string
  password?: string
  confirmPassword?: string
}

function validate(name: string, email: string, password: string, confirmPassword: string): FormErrors {
  const errors: FormErrors = {}
  if (!name.trim()) errors.name = 'Full name is required'
  if (!email.trim()) {
    errors.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address'
  }
  if (!password) {
    errors.password = 'Password is required'
  } else if (getStrengthScore(password) < 5) {
    errors.password = 'Password must meet all requirements'
  }
  if (!confirmPassword) {
    errors.confirmPassword = 'Please confirm your password'
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }
  return errors
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const strengthScore = getStrengthScore(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const formErrors = validate(name, email, password, confirmPassword)
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors)
      return
    }
    setErrors({})
    setIsLoading(true)
    try {
      await register({ name, email, password })
      setSubmitted(true)
    } catch (err: unknown) {
      const apiErr = err as { message?: string; statusCode?: number }
      if (apiErr?.message?.toLowerCase().includes('email')) {
        setErrors({ email: apiErr.message ?? 'Email already in use' })
      } else {
        toast.error(apiErr?.message ?? 'Registration failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ── Success view ──
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-500/15 p-4">
                <Mail className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Check your email</h2>
            <p className="text-sm text-muted-foreground mb-6">
              We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
              Click the link to activate your account.
            </p>
            <Link to={ROUTES.LOGIN}>
              <Button variant="outline" className="w-full">Back to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Registration form ──
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <Link
          to={ROUTES.HOME}
          className="flex items-center gap-1.5 px-6 pt-6 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Start reviewing code smarter with LintWise</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="Jane Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              autoComplete="name"
              autoFocus
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />

            <div className="space-y-2">
              <Input
                label="Password"
                type="password"
                placeholder="Create a password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="new-password"
              />

              {/* Strength bar */}
              {password && (
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

                  {/* Requirements checklist */}
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {PASSWORD_RULES.map((rule) => {
                      const met = rule.test(password)
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
              label="Confirm Password"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full" size="lg" loading={isLoading}>
              Create Account
            </Button>
          </form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to={ROUTES.LOGIN} className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
