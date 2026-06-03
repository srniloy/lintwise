import { useEffect, useRef, useState } from 'react'
import { reviewService } from '@/services/reviewService'
import type { Review, ReviewStatus } from '@/types/review'

const POLL_INTERVAL_MS = 3_000
const TERMINAL: ReviewStatus[] = ['COMPLETED', 'FAILED']

export interface UseReviewStatusResult {
  review: Review | null
  loading: boolean
  error: string | null
  elapsed: number
}

export function useReviewStatus(id: string | undefined): UseReviewStatusResult {
  const [review, setReview] = useState<Review | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearAll() {
    if (pollRef.current)  clearInterval(pollRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    pollRef.current  = null
    timerRef.current = null
  }

  useEffect(() => {
    if (!id) return

    let cancelled = false

    const startTracking = (initial: Review) => {
      if (TERMINAL.includes(initial.status)) return

      // elapsed timer — ticks every second
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1)
      }, 1_000)

      // poll for status changes
      pollRef.current = setInterval(async () => {
        try {
          const updated = await reviewService.getById(id)
          if (cancelled) return
          setReview(updated)
          if (TERMINAL.includes(updated.status)) clearAll()
        } catch {
          // ignore transient network errors during polling
        }
      }, POLL_INTERVAL_MS)
    }

    reviewService
      .getById(id)
      .then((r) => {
        if (cancelled) return
        setReview(r)
        setLoading(false)
        startTracking(r)
      })
      .catch((err: { message?: string }) => {
        if (cancelled) return
        setError(err?.message ?? 'Review not found')
        setLoading(false)
      })

    return () => {
      cancelled = true
      clearAll()
    }
  }, [id])

  return { review, loading, error, elapsed }
}
