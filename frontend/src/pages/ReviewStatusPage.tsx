import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { useReviewStatus } from '@/hooks/useReviewStatus'
import type { ReviewStatus } from '@/types/review'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const ESTIMATED_SECS = 30

const STEPS: { key: ReviewStatus; label: string; detail: string }[] = [
  { key: 'PENDING',    label: 'Queued',    detail: "Your review is waiting in queue" },
  { key: 'PROCESSING', label: 'Analyzing', detail: 'AI is reviewing your code'        },
  { key: 'COMPLETED',  label: 'Complete',  detail: 'Analysis finished successfully'   },
]

function stepIndex(status: ReviewStatus): number {
  return STEPS.findIndex((s) => s.key === status)
}

function formatElapsed(secs: number): string {
  if (secs < 60) return `${secs}s elapsed`
  return `${Math.floor(secs / 60)}m ${secs % 60}s elapsed`
}

// Smooth 0 → ~90% over ESTIMATED_SECS while PROCESSING; stays at 10% while PENDING
function progressPercent(status: ReviewStatus, elapsed: number): number {
  if (status === 'PENDING')    return 10
  if (status === 'COMPLETED')  return 100
  if (status === 'FAILED')     return 0
  // PROCESSING: 15% base, grows toward 90% over ESTIMATED_SECS
  return Math.min(90, 15 + (elapsed / ESTIMATED_SECS) * 75)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReviewStatusPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { review, loading, error, elapsed } = useReviewStatus(id)

  // Auto-navigate to results when COMPLETED
  useEffect(() => {
    if (review?.status === 'COMPLETED') {
      navigate(ROUTES.REVIEW_DETAIL(review.id), { replace: true })
    }
  }, [review?.status, review?.id, navigate])

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // ── Fetch error / not found ───────────────────────────────────────────────

  if (error || !review) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-lg font-semibold text-foreground">Review Not Found</h2>
        <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" onClick={() => navigate(ROUTES.REVIEWS)}>
          <ArrowLeft className="h-4 w-4" />
          Back to Reviews
        </Button>
      </div>
    )
  }

  // ── FAILED state ─────────────────────────────────────────────────────────

  if (review.status === 'FAILED') {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-5">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">Analysis Failed</h2>
            <p className="text-sm text-muted-foreground">
              Something went wrong while analyzing your code. Please try submitting again.
            </p>
          </div>

          {review.title && (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-sm font-medium text-foreground">
              {review.title}
            </p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button variant="primary" onClick={() => navigate(ROUTES.REVIEW_NEW)}>
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => navigate(ROUTES.REVIEWS)}>
              <ArrowLeft className="h-4 w-4" />
              Back to Reviews
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Active tracking (PENDING / PROCESSING) ────────────────────────────────

  const currentIdx   = stepIndex(review.status)
  const currentStep  = STEPS[currentIdx]
  const progress     = progressPercent(review.status, elapsed)
  const remaining    = Math.max(0, ESTIMATED_SECS - elapsed)
  const showRemaining = review.status === 'PROCESSING' && remaining > 0

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">

      {/* Breadcrumb + header */}
      <div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1.5">
          <button
            onClick={() => navigate(ROUTES.REVIEWS)}
            className="hover:text-foreground transition-colors"
          >
            Reviews
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">Status</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {review.title ?? 'Untitled Review'}
        </h1>
        <div className="mt-1.5 flex items-center gap-2">
          <Badge variant="outline" className="capitalize text-xs">
            {review.language}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Submitted {new Date(review.createdAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Status card */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">

        {/* Timeline */}
        <div className="px-8 pt-8 pb-6">
          <div className="relative flex items-start justify-between">
            {/* Connector track */}
            <div
              className="absolute left-[calc(100%/6)] right-[calc(100%/6)] top-5 h-0.5 bg-border"
              aria-hidden
            />

            {STEPS.map((step, i) => {
              const isDone   = currentIdx > i
              const isActive = currentIdx === i

              return (
                <div
                  key={step.key}
                  className="relative z-10 flex flex-1 flex-col items-center gap-2.5"
                >
                  {/* Circle */}
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full border-2',
                      'transition-all duration-300',
                      isDone   && 'border-green-500 bg-green-500 text-white',
                      isActive && 'border-primary bg-primary text-primary-foreground shadow-md',
                      !isDone && !isActive && 'border-border bg-background text-muted-foreground',
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : isActive ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <span className="text-sm font-semibold">{i + 1}</span>
                    )}
                  </div>

                  {/* Label */}
                  <p
                    className={cn(
                      'text-sm font-medium',
                      isDone   && 'text-green-600 dark:text-green-400',
                      isActive && 'text-foreground',
                      !isDone && !isActive && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-8 pb-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                review.status === 'PROCESSING' && 'bg-primary',
                review.status === 'PENDING'    && 'bg-muted-foreground/40',
                review.status === 'COMPLETED'  && 'bg-green-500',
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Detail + timers */}
        <div className="px-8 py-5 space-y-3">
          {/* Current step description */}
          <div className="rounded-lg bg-muted/40 px-4 py-3 text-center space-y-0.5">
            <p className="text-sm font-medium text-foreground">{currentStep.detail}</p>
            {review.status === 'PENDING' && (
              <p className="text-xs text-muted-foreground">
                Analysis will start shortly
              </p>
            )}
            {review.status === 'PROCESSING' && elapsed > ESTIMATED_SECS && (
              <p className="text-xs text-muted-foreground">
                Taking a little longer than usual — almost there
              </p>
            )}
          </div>

          {/* Elapsed / remaining row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatElapsed(elapsed)}</span>
            </div>
            {showRemaining && (
              <span>~{remaining}s remaining</span>
            )}
          </div>
        </div>
      </div>

      {/* Footer hint */}
      <p className="text-center text-xs text-muted-foreground">
        Checking for updates every 3 seconds. You can safely leave — results will appear in your{' '}
        <button
          onClick={() => navigate(ROUTES.REVIEWS)}
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          review history
        </button>
        .
      </p>
    </div>
  )
}
