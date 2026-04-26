import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { teamService } from '@/services/teamService'
import { ROUTES } from '@/constants/routes'
import { Spinner } from '@/components/ui/spinner'

type State = 'loading' | 'success' | 'error'

export default function TeamAcceptPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [state, setState] = useState<State>('loading')
  const [message, setMessage] = useState('')
  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true

    const token = searchParams.get('token')
    if (!token) {
      setState('error')
      setMessage('Invalid invitation link — no token found.')
      return
    }

    teamService
      .acceptInvite(token)
      .then(() => {
        setState('success')
        setTimeout(() => navigate(ROUTES.TEAM, { replace: true }), 2000)
      })
      .catch((err: unknown) => {
        setState('error')
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Failed to accept invitation.'
        setMessage(msg)
      })
  }, [navigate, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        {state === 'loading' && (
          <>
            <Spinner size="lg" className="mx-auto mb-4" />
            <p className="text-muted-foreground">Accepting invitation…</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="mb-4 text-4xl">✓</div>
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              You've joined the team!
            </h2>
            <p className="text-muted-foreground">Redirecting to your team page…</p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="mb-4 text-4xl">✗</div>
            <h2 className="mb-2 text-xl font-semibold text-foreground">
              Invitation failed
            </h2>
            <p className="mb-6 text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate(ROUTES.DASHBOARD, { replace: true })}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
