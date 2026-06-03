import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { authService } from '@/services/authService'
import { ROUTES } from '@/constants/routes'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!email.trim()) {
      setEmailError('Email is required')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address')
      return
    }
    setEmailError(null)
    setIsLoading(true)

    try {
      await authService.forgotPassword(email)
      setSent(true)
    } catch (err: unknown) {
      const apiErr = err as { message?: string }
      toast.error(apiErr?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Success state ──
  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-primary/10 p-4">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Check your inbox</h2>
            <p className="text-sm text-muted-foreground mb-1">
              We sent a password reset link to
            </p>
            <p className="text-sm font-medium text-foreground mb-6">{email}</p>
            <p className="text-xs text-muted-foreground mb-6">
              Didn&apos;t receive it? Check your spam folder or{' '}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-primary hover:underline"
              >
                try a different email
              </button>
              .
            </p>
            <Link to={ROUTES.LOGIN}>
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Form ──
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Forgot password?</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
              error={emailError ?? undefined}
              autoComplete="email"
              autoFocus
            />

            <Button type="submit" className="w-full" size="lg" loading={isLoading}>
              Send Reset Link
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
