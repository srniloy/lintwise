import { useState, useEffect, useMemo, useRef, useCallback, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  GitCompareArrows,
  X,
  ArrowUpDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCode2,
  Trash2,
  ClipboardList,
} from 'lucide-react'
import { toast } from 'sonner'
import { ROUTES } from '@/constants/routes'
import { reviewService } from '@/services/reviewService'
import type { ExportFormat } from '@/services/reviewService'
import { saveBlobAs } from '@/lib/download'
import { ExportMenu } from '@/components/ExportMenu'
import type { Review, ReviewStatus } from '@/types/review'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '@/components/ui/modal'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10
const FETCH_LIMIT = 100

type DateRange = '7d' | '30d' | '90d' | 'all'
type SortKey = 'date' | 'score' | 'issues'
type SortDir = 'asc' | 'desc'

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS_BADGE: Record<ReviewStatus, BadgeProps['variant']> = {
  PENDING: 'secondary',
  PROCESSING: 'default',
  COMPLETED: 'success',
  FAILED: 'critical',
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

const STATUS_ICON: Record<ReviewStatus, React.ReactNode> = {
  PENDING: <Clock className="h-3 w-3" />,
  PROCESSING: <Loader2 className="h-3 w-3 animate-spin" />,
  COMPLETED: <CheckCircle2 className="h-3 w-3" />,
  FAILED: <AlertCircle className="h-3 w-3" />,
}

// ── Grade helpers ─────────────────────────────────────────────────────────────

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

function getGrade(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

const GRADE_COLOR: Record<Grade, string> = {
  A: 'text-green-600 dark:text-green-400',
  B: 'text-emerald-600 dark:text-emerald-400',
  C: 'text-yellow-600 dark:text-yellow-400',
  D: 'text-orange-600 dark:text-orange-400',
  F: 'text-destructive',
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(diffDays > 365 ? { year: 'numeric' } : {}),
  })
}

function cutoffDate(range: DateRange): Date | null {
  if (range === 'all') return null
  const d = new Date()
  d.setDate(d.getDate() - { '7d': 7, '30d': 30, '90d': 90 }[range])
  return d
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function ReviewRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <Skeleton className="h-4 w-4 shrink-0 rounded" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-12" />
    </div>
  )
}

// ── ReviewRow ─────────────────────────────────────────────────────────────────

interface ReviewRowProps {
  review: Review
  selected: boolean
  selectable: boolean
  onSelect: (id: string) => void
  onNavigate: (id: string) => void
  onDelete: (id: string) => void
}

const ReviewRow = memo(function ReviewRow({ review, selected, selectable, onSelect, onNavigate, onDelete }: ReviewRowProps) {
  const issueCount = review.issues?.length
  const score = review.overallScore
  const grade = score != null ? getGrade(score) : null

  function handleCheckbox(e: React.MouseEvent) {
    e.stopPropagation()
    if (selectable) onSelect(review.id)
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    onDelete(review.id)
  }

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={() => review.status === 'COMPLETED' && onNavigate(review.id)}
      onKeyDown={(e) => e.key === 'Enter' && review.status === 'COMPLETED' && onNavigate(review.id)}
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3',
        'transition-colors duration-150',
        review.status === 'COMPLETED'
          ? 'cursor-pointer hover:border-primary/30 hover:bg-muted/20'
          : 'cursor-default',
        selected && 'border-primary/50 bg-primary/5',
      )}
    >
      {/* Checkbox */}
      <div
        onClick={handleCheckbox}
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
          selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-30',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background',
        )}
        role="checkbox"
        aria-checked={selected}
        aria-disabled={!selectable}
        tabIndex={-1}
      >
        {selected && (
          <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-current">
            <path d="M1 4l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Title + language */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {review.title ?? <span className="italic text-muted-foreground">Untitled Review</span>}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <FileCode2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs capitalize text-muted-foreground">{review.language}</span>
        </div>
      </div>

      {/* Status */}
      <Badge variant={STATUS_BADGE[review.status]} className="hidden shrink-0 items-center gap-1 sm:inline-flex">
        {STATUS_ICON[review.status]}
        {STATUS_LABEL[review.status]}
      </Badge>

      {/* Date */}
      <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground md:block">
        {formatRelativeDate(review.createdAt)}
      </span>

      {/* Issue count */}
      <span className="hidden w-14 shrink-0 text-right text-sm text-muted-foreground lg:block">
        {issueCount != null ? (
          <span className={cn(issueCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground')}>
            {issueCount}
          </span>
        ) : '—'}
      </span>

      {/* Score + grade */}
      <div className="hidden w-16 shrink-0 items-center justify-end gap-1 xl:flex">
        {score != null && grade ? (
          <>
            <span className="text-sm font-medium text-foreground">{score}</span>
            <span className={cn('text-sm font-bold', GRADE_COLOR[grade])}>{grade}</span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>

      {/* Delete button (hover) */}
      <button
        type="button"
        onClick={handleDelete}
        className={cn(
          'shrink-0 rounded p-1 text-muted-foreground transition-colors',
          'opacity-0 group-hover:opacity-100',
          'hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label="Delete review"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Nav arrow */}
      {review.status === 'COMPLETED' && (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      )}
    </div>
  )
})

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  // Build page number list with ellipsis
  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total} reviews
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline" size="sm"
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md text-xs transition-colors',
                p === page
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}

        <Button
          variant="outline" size="sm"
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ── CompareModal ──────────────────────────────────────────────────────────────

function CompareModal({
  reviews,
  open,
  onClose,
  onNavigate,
}: {
  reviews: Review[]
  open: boolean
  onClose: () => void
  onNavigate: (id: string) => void
}) {
  if (reviews.length !== 2) return null

  const [a, b] = reviews

  function ScoreBlock({ review }: { review: Review }) {
    const score = review.overallScore
    const grade = score != null ? getGrade(score) : null
    const issueCount = review.issues?.length ?? 0
    const severities: { label: string; key: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'; color: string }[] = [
      { label: 'Critical', key: 'CRITICAL', color: 'text-destructive' },
      { label: 'High', key: 'HIGH', color: 'text-orange-500' },
      { label: 'Medium', key: 'MEDIUM', color: 'text-yellow-500' },
      { label: 'Low', key: 'LOW', color: 'text-blue-500' },
    ]

    return (
      <div className="flex flex-1 flex-col gap-4 rounded-lg border border-border bg-card p-4">
        {/* Title */}
        <div>
          <p className="font-semibold text-foreground leading-snug line-clamp-2">
            {review.title ?? 'Untitled Review'}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="capitalize">{review.language}</span>
            <span>·</span>
            <span>{formatRelativeDate(review.createdAt)}</span>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-baseline gap-2">
          {score != null && grade ? (
            <>
              <span className="text-4xl font-bold text-foreground">{score}</span>
              <span className={cn('text-2xl font-bold', GRADE_COLOR[grade])}>{grade}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Score N/A</span>
          )}
        </div>

        {/* Issue breakdown */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-muted-foreground">Total Issues</span>
            <span className="text-foreground">{issueCount}</span>
          </div>
          {severities.map(({ label, key, color }) => {
            const count = review.issues?.filter((i) => i.severity === key).length ?? 0
            if (count === 0) return null
            return (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn('font-medium', color)}>{count}</span>
              </div>
            )
          })}
          {issueCount === 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">No issues found!</p>
          )}
        </div>

        <Button
          variant="outline" size="sm" className="mt-auto w-full"
          onClick={() => { onClose(); onNavigate(review.id) }}
        >
          View Full Results
        </Button>
      </div>
    )
  }

  // Delta indicators
  const scoreA = a.overallScore ?? 0
  const scoreB = b.overallScore ?? 0
  const scoreDelta = scoreA - scoreB
  const issuesA = a.issues?.length ?? 0
  const issuesB = b.issues?.length ?? 0
  const issuesDelta = issuesA - issuesB

  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent className="max-w-2xl" showClose>
        <ModalHeader>
          <ModalTitle>Compare Reviews</ModalTitle>
          <ModalDescription>
            Side-by-side comparison of scores and issue breakdowns.
          </ModalDescription>
        </ModalHeader>

        {/* Delta summary */}
        {a.overallScore != null && b.overallScore != null && (
          <div className="mb-4 flex flex-wrap gap-3 rounded-lg bg-muted/40 px-4 py-3 text-xs">
            <span className="text-muted-foreground">
              Score difference:{' '}
              <span className={cn('font-medium', scoreDelta > 0 ? 'text-green-600 dark:text-green-400' : scoreDelta < 0 ? 'text-destructive' : 'text-foreground')}>
                {scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta} pts
              </span>
            </span>
            <span className="text-muted-foreground">
              Issue difference:{' '}
              <span className={cn('font-medium', issuesDelta < 0 ? 'text-green-600 dark:text-green-400' : issuesDelta > 0 ? 'text-destructive' : 'text-foreground')}>
                {issuesDelta > 0 ? `+${issuesDelta}` : issuesDelta} issues
              </span>
            </span>
          </div>
        )}

        {/* Side by side */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <ScoreBlock review={a} />
          <div className="flex items-center justify-center text-xs font-semibold text-muted-foreground sm:flex-col">
            <span className="hidden sm:block">vs</span>
            <span className="block sm:hidden">vs</span>
          </div>
          <ScoreBlock review={b} />
        </div>

        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

function DeleteConfirmModal({
  review,
  open,
  onClose,
  onConfirm,
}: {
  review: Review | null
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()}>
      <ModalContent showClose>
        <ModalHeader>
          <ModalTitle>Delete Review</ModalTitle>
          <ModalDescription>
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">
              "{review?.title ?? 'Untitled Review'}"
            </span>
            ? This action cannot be undone.
          </ModalDescription>
        </ModalHeader>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>Delete</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

// ── ReviewsPage ───────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const navigate = useNavigate()

  // ── Data ──────────────────────────────────────────────────────────────────
  const [allReviews, setAllReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ── Filters ───────────────────────────────────────────────────────────────
  const [searchRaw, setSearchRaw] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | 'ALL'>('ALL')
  const [langFilter, setLangFilter] = useState('ALL')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)

  // ── Selection & comparison ────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [compareOpen, setCompareOpen] = useState(false)

  // ── Delete ────────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)

  // ── Bulk export ───────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false)

  // ── Debounce search ───────────────────────────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function handleSearchChange(val: string) {
    setSearchRaw(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(val)
      setPage(1)
    }, 250)
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const loadReviews = useCallback(() => {
    setLoading(true)
    reviewService
      .list({ limit: FETCH_LIMIT })
      .then((res) => { setAllReviews(res.reviews); setLoading(false) })
      .catch((err: { message?: string }) => {
        setError(err?.message ?? 'Failed to load reviews')
        setLoading(false)
      })
  }, [])

  useEffect(() => { loadReviews() }, [loadReviews])

  // ── Derived: available languages ──────────────────────────────────────────
  const availableLanguages = useMemo(() => {
    const seen = new Set<string>()
    allReviews?.forEach((r) => seen.add(r.language))
    return Array.from(seen).sort()
  }, [allReviews])

  // ── Derived: filtered + sorted + paginated ─────────────────────────────────
  const filteredReviews = useMemo(() => {
    const cutoff = cutoffDate(dateRange)
    const q = search.trim().toLowerCase()

    return allReviews
      .filter((r) => {
        if (statusFilter !== 'ALL' && r.status !== statusFilter) return false
        if (langFilter !== 'ALL' && r.language !== langFilter) return false
        if (cutoff && new Date(r.createdAt) < cutoff) return false
        if (q) {
          const titleMatch = r.title?.toLowerCase().includes(q)
          const langMatch = r.language.toLowerCase().includes(q)
          if (!titleMatch && !langMatch) return false
        }
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'date') {
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        } else if (sortKey === 'score') {
          cmp = (a.overallScore ?? -1) - (b.overallScore ?? -1)
        } else if (sortKey === 'issues') {
          cmp = (a.issues?.length ?? 0) - (b.issues?.length ?? 0)
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [allReviews, statusFilter, langFilter, dateRange, search, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pagedReviews = filteredReviews.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleFilterChange<T>(setter: (v: T) => void, val: T) {
    setter(val)
    setPage(1)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(1)
  }

  // ── Selection logic ───────────────────────────────────────────────────────
  const MAX_SELECT = 20

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= MAX_SELECT) {
          toast.error(`You can select up to ${MAX_SELECT} reviews at a time`)
          return prev
        }
        next.add(id)
      }
      return next
    })
  }

  function clearSelection() { setSelected(new Set()) }

  // ── Bulk export ───────────────────────────────────────────────────────────
  async function handleBulkExport(format: ExportFormat) {
    const ids = Array.from(selected)
    if (ids.length === 0) return

    setExporting(true)
    let successCount = 0
    let firstError: string | null = null

    for (const id of ids) {
      try {
        const { blob, filename } = await reviewService.exportById(id, format)
        saveBlobAs(blob, filename)
        successCount++
      } catch (err) {
        if (!firstError) firstError = (err as { message?: string })?.message ?? 'Export failed'
      }
    }

    setExporting(false)

    if (successCount > 0 && !firstError) {
      toast.success(
        successCount === 1
          ? `Exported as ${format.toUpperCase()}`
          : `Exported ${successCount} reviews as ${format.toUpperCase()}`,
      )
    } else if (successCount > 0 && firstError) {
      toast.warning(`Exported ${successCount} of ${ids.length} reviews. ${firstError}`)
    } else {
      toast.error(firstError ?? 'Export failed')
    }
  }

  const compareReviews = useMemo(
    () => Array.from(selected).map((id) => allReviews.find((r) => r.id === id)!).filter(Boolean),
    [selected, allReviews],
  )

  // ── Delete logic ──────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await reviewService.deleteById(deleteTarget.id)
      setAllReviews((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      setSelected((prev) => { const next = new Set(prev); next.delete(deleteTarget.id); return next })
      toast.success('Review deleted')
    } catch {
      toast.error('Failed to delete review')
    } finally {
      setDeleteTarget(null)
    }
  }

  const hasActiveFilters =
    statusFilter !== 'ALL' || langFilter !== 'ALL' || dateRange !== 'all' || search !== ''

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review History</h1>
          {!loading && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {allReviews.length} review{allReviews.length !== 1 ? 's' : ''} total
            </p>
          )}
        </div>
        <Button onClick={() => navigate(ROUTES.REVIEW_NEW)} size="sm">
          <Plus className="h-4 w-4" />
          New Review
        </Button>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Search by title or language…"
            value={searchRaw}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={cn(
              'flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1',
              'text-sm text-foreground placeholder:text-muted-foreground shadow-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          />
        </div>

        {/* Status filter */}
        <div className="w-full sm:w-36">
          <Select
            value={statusFilter}
            onValueChange={(v) => handleFilterChange(setStatusFilter, v as ReviewStatus | 'ALL')}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Language filter */}
        <div className="w-full sm:w-36">
          <Select
            value={langFilter}
            onValueChange={(v) => handleFilterChange(setLangFilter, v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All languages</SelectItem>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang} value={lang} className="capitalize">
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date range */}
        <div className="w-full sm:w-36">
          <Select
            value={dateRange}
            onValueChange={(v) => handleFilterChange(setDateRange, v as DateRange)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost" size="sm"
            onClick={() => {
              setSearchRaw(''); setSearch('')
              setStatusFilter('ALL'); setLangFilter('ALL')
              setDateRange('all'); setPage(1)
            }}
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* ── Table header (column labels + sort) ── */}
      {!loading && filteredReviews.length > 0 && (
        <div className="flex items-center gap-3 px-4 text-xs font-medium text-muted-foreground">
          <div className="w-4 shrink-0" />
          <div className="flex-1">Review</div>
          <div className="hidden w-20 sm:block">Status</div>
          <button
            onClick={() => toggleSort('date')}
            className="hidden w-20 items-center justify-end gap-1 hover:text-foreground transition-colors md:flex"
          >
            Date
            <ArrowUpDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => toggleSort('issues')}
            className="hidden w-14 items-center justify-end gap-1 hover:text-foreground transition-colors lg:flex"
          >
            Issues
            <ArrowUpDown className="h-3 w-3" />
          </button>
          <button
            onClick={() => toggleSort('score')}
            className="hidden w-16 items-center justify-end gap-1 hover:text-foreground transition-colors xl:flex"
          >
            Score
            <ArrowUpDown className="h-3 w-3" />
          </button>
          <div className="w-5 shrink-0" />
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <ReviewRowSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border py-16 text-center">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="font-semibold text-foreground">Failed to load reviews</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={loadReviews}>Retry</Button>
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border py-16 text-center">
          {allReviews.length === 0 ? (
            <>
              <ClipboardList className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">No reviews yet</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Submit your first code review to see it here.
                </p>
              </div>
              <Button onClick={() => navigate(ROUTES.REVIEW_NEW)}>
                <Plus className="h-4 w-4" />
                New Review
              </Button>
            </>
          ) : (
            <>
              <Search className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-semibold text-foreground">No reviews match your filters</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Try adjusting the search or filters.</p>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {pagedReviews.map((review) => (
            <ReviewRow
              key={review.id}
              review={review}
              selected={selected.has(review.id)}
              selectable={review.status === 'COMPLETED'}
              onSelect={toggleSelect}
              onNavigate={(id) => navigate(ROUTES.REVIEW_DETAIL(id))}
              onDelete={(id) => setDeleteTarget(allReviews.find((r) => r.id === id) ?? null)}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {!loading && filteredReviews.length > PAGE_SIZE && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          total={filteredReviews.length}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      )}

      {/* ── Selection sticky bar ── */}
      {selected.size > 0 && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 z-40 -translate-x-1/2',
            'flex items-center gap-3 rounded-full border border-border bg-background px-5 py-2.5 shadow-lg',
            'transition-all duration-200',
          )}
        >
          <span className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selected.size}</span> selected
          </span>
          <Button
            size="sm"
            disabled={selected.size !== 2}
            onClick={() => setCompareOpen(true)}
            title={selected.size !== 2 ? 'Select exactly 2 reviews to compare' : undefined}
          >
            <GitCompareArrows className="h-4 w-4" />
            Compare
          </Button>
          <ExportMenu
            onExport={handleBulkExport}
            loading={exporting}
            label={selected.size > 1 ? `Export ${selected.size}` : 'Export'}
            align="right"
          />
          <button
            onClick={clearSelection}
            className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      <CompareModal
        reviews={compareReviews}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        onNavigate={(id) => navigate(ROUTES.REVIEW_DETAIL(id))}
      />

      <DeleteConfirmModal
        review={deleteTarget}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
