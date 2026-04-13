import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, MailOpen, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { authService } from '@/services/authService'
import { ROUTES } from '@/constants/routes'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Status = 'verifying' | 'success' | 'invalid' | 'expired'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [status, setStatus] = useState<Status>('verifying')
  const [resendEmail, setResendEmail] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSent, setResendSent] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }

    authService
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => {
        const msg = (err as { message?: string })?.message ?? ''
        if (msg.toLowerCase().includes('expired')) {
          setStatus('expired')
        } else {
          setStatus('invalid')
        }
      })
  }, [token])

  async function handleResend(e: React.FormEvent) {
    e.preventDefault()
    if (!resendEmail.trim()) return
    setResendLoading(true)
    try {
      await authService.resendVerification(resendEmail.trim())
      setResendSent(true)
      toast.success('Verification email sent!')
    } catch {
      toast.error('Failed to resend. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  // ── Verifying ──────────────────────────────────────────────────────────────
  if (status === 'verifying') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Verifying your email address…</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/15 p-4">
                <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">Email verified!</h2>
              <p className="text-sm text-muted-foreground">
                Your account is now active. You can sign in and start using LintWise.
              </p>
            </div>
            <Link to={ROUTES.LOGIN}>
              <Button className="w-full mt-2">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Expired ────────────────────────────────────────────────────────────────
  if (status === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="flex justify-center">
              <div className="rounded-full bg-yellow-500/15 p-4">
                <MailOpen className="h-10 w-10 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-foreground">Link expired</h2>
              <p className="text-sm text-muted-foreground">
                This verification link has expired. Enter your email to receive a new one.
              </p>
            </div>

            {resendSent ? (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                A new verification link has been sent. Check your inbox.
              </p>
            ) : (
              <form onSubmit={handleResend} className="space-y-3 text-left">
                <Input
                  label="Email address"
                  type="email"
                  placeholder="you@example.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
                <Button type="submit" className="w-full" loading={resendLoading}>
                  Resend Verification Email
                </Button>
              </form>
            )}

            <Link to={ROUTES.LOGIN} className="block text-sm text-muted-foreground hover:text-foreground">
              Back to Sign In
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Invalid ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-500/15 p-4">
              <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Invalid link</h2>
            <p className="text-sm text-muted-foreground">
              This verification link is invalid or has already been used. Please register again or contact support.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link to={ROUTES.REGISTER}>
              <Button variant="outline" className="w-full">Create an Account</Button>
            </Link>
            <Link to={ROUTES.LOGIN} className="text-sm text-muted-foreground hover:text-foreground">
              Back to Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
