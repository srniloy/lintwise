import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Navigate } from 'react-router-dom'
import CodeMirror from '@uiw/react-codemirror'
import { loadLanguage } from '@uiw/codemirror-extensions-langs'
import type { LanguageName } from '@uiw/codemirror-extensions-langs'
import {
  Shield,
  Zap,
  Star,
  Palette,
  BookOpen,
  FlaskConical,
  Package,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ArrowLeft,
  Download,
  FileCode2,
  MapPin,
  Lightbulb,
  AlertCircle,
  PartyPopper,
  X,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { reviewService } from '@/services/reviewService'
import { useThemeStore } from '@/store/themeStore'
import type { Review, Issue, IssueCategory, IssueSeverity } from '@/types/review'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

// ── Grade helpers ──────────────────────────────────────────────────────────────

type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

function getGrade(score: number): Grade {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 70) return 'C'
  if (score >= 60) return 'D'
  return 'F'
}

const GRADE_STROKE: Record<Grade, string> = {
  A: '#22c55e',
  B: '#10b981',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
}

const GRADE_TEXT: Record<Grade, string> = {
  A: 'text-green-600 dark:text-green-400',
  B: 'text-emerald-600 dark:text-emerald-400',
  C: 'text-yellow-600 dark:text-yellow-400',
  D: 'text-orange-600 dark:text-orange-400',
  F: 'text-destructive',
}

// ── Category metadata ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  IssueCategory,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  SECURITY:      { label: 'Security',      Icon: Shield       },
  PERFORMANCE:   { label: 'Performance',   Icon: Zap          },
  QUALITY:       { label: 'Quality',       Icon: Star         },
  STYLE:         { label: 'Style',         Icon: Palette      },
  DOCUMENTATION: { label: 'Documentation', Icon: BookOpen     },
  TESTING:       { label: 'Testing',       Icon: FlaskConical },
  DEPENDENCIES:  { label: 'Dependencies',  Icon: Package      },
}

const ALL_CATEGORIES = Object.keys(CATEGORY_META) as IssueCategory[]

// ── Severity metadata ─────────────────────────────────────────────────────────

const SEVERITY_VARIANT: Record<IssueSeverity, BadgeProps['variant']> = {
  CRITICAL: 'critical',
  HIGH:     'high',
  MEDIUM:   'medium',
  LOW:      'low',
}

const SEVERITY_ORDER: IssueSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const SEVERITY_BG: Record<IssueSeverity, string> = {
  CRITICAL: 'bg-destructive/10 text-destructive border-destructive/20',
  HIGH:     'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  MEDIUM:   'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
  LOW:      'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
}

// ── ScoreRing ─────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const grade = getGrade(score)
  const r = 46
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex items-center justify-center">
        <svg
          width="128" height="128" viewBox="0 0 128 128"
          className="-rotate-90"
          aria-label={`Score: ${score} out of 100`}
        >
          {/* Track */}
          <circle
            cx="64" cy="64" r={r}
            fill="none" stroke="currentColor"
            strokeWidth="10"
            className="text-muted/60"
          />
          {/* Progress arc */}
          <circle
            cx="64" cy="64" r={r}
            fill="none"
            stroke={GRADE_STROKE[grade]}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        {/* Centered text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-foreground leading-none">{score}</span>
          <span className="text-[11px] text-muted-foreground leading-none mt-0.5">/100</span>
        </div>
      </div>
      <div className="text-center">
        <span className={cn('text-4xl font-bold', GRADE_TEXT[grade])}>{grade}</span>
        <p className="text-xs text-muted-foreground mt-0.5">Code Health Grade</p>
      </div>
    </div>
  )
}

// ── SeverityBreakdown ─────────────────────────────────────────────────────────

function SeverityBreakdown({ issues }: { issues: Issue[] }) {
  const counts = useMemo(() => {
    const map: Record<IssueSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    issues.forEach((i) => map[i.severity]++)
    return map
  }, [issues])

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SEVERITY_ORDER.map((sev) => (
        <div
          key={sev}
          className={cn(
            'rounded-lg border px-4 py-3 text-center',
            SEVERITY_BG[sev],
          )}
        >
          <p className="text-2xl font-bold">{counts[sev]}</p>
          <p className="text-xs font-medium mt-0.5 capitalize">{sev.toLowerCase()}</p>
        </div>
      ))}
    </div>
  )
}

// ── CategoryBreakdown ─────────────────────────────────────────────────────────

function CategoryBreakdown({ issues }: { issues: Issue[] }) {
  const rows = useMemo(() => {
    const counts: Partial<Record<IssueCategory, number>> = {}
    issues.forEach((i) => {
      counts[i.category] = (counts[i.category] ?? 0) + 1
    })
    const maxCount = Math.max(1, ...Object.values(counts))
    return ALL_CATEGORIES
      .map((cat) => ({ cat, count: counts[cat] ?? 0, maxCount }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [issues])

  if (rows.length === 0) return null

  return (
    <div className="space-y-2">
      {rows.map(({ cat, count, maxCount }) => {
        const { label, Icon } = CATEGORY_META[cat]
        const pct = Math.round((count / maxCount) * 100)
        return (
          <div key={cat} className="flex items-center gap-3">
            <div className="flex w-36 shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-right text-xs font-medium text-foreground">{count}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── FilterChip ────────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-all',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {label}
    </button>
  )
}

// ── IssueCard ─────────────────────────────────────────────────────────────────

function IssueCard({
  issue,
  expanded,
  onToggle,
}: {
  issue: Issue
  expanded: boolean
  onToggle: () => void
}) {
  const { label, Icon } = CATEGORY_META[issue.category]

  const lineLabel =
    issue.lineStart != null
      ? issue.lineEnd != null && issue.lineEnd !== issue.lineStart
        ? `Lines ${issue.lineStart}–${issue.lineEnd}`
        : `Line ${issue.lineStart}`
      : null

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card transition-colors duration-150',
        expanded && 'border-primary/30',
      )}
    >
      {/* Header */}
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <Badge variant={SEVERITY_VARIANT[issue.severity]} className="mt-0.5 shrink-0 uppercase">
          {issue.severity.toLowerCase()}
        </Badge>

        <div className="min-w-0 flex-1">
          <p className="font-medium text-foreground leading-snug">{issue.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {label}
            </span>
            {issue.fileName && (
              <span className="flex items-center gap-1">
                <FileCode2 className="h-3 w-3" />
                {issue.fileName}
              </span>
            )}
            {lineLabel && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {lineLabel}
              </span>
            )}
          </div>
        </div>

        {expanded
          ? <ChevronUp className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          : <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        }
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">Description</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{issue.description}</p>
          </div>

          {issue.suggestion && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Lightbulb className="h-3.5 w-3.5 text-yellow-500" />
                Suggested Fix
              </p>
              <p className="rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                {issue.suggestion}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── ReviewDetailPage ──────────────────────────────────────────────────────────

export default function ReviewDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)

  const [review, setReview]             = useState<Review | null>(null)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [activeTab, setActiveTab]       = useState('summary')
  const [expandedIds, setExpandedIds]   = useState<Set<string>>(new Set())
  const [sevFilter, setSevFilter]       = useState<Set<IssueSeverity>>(new Set())
  const [catFilter, setCatFilter]       = useState<Set<IssueCategory>>(new Set())

  // ── Fetch ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    reviewService
      .getById(id)
      .then((r) => { setReview(r); setLoading(false) })
      .catch((err: { message?: string }) => {
        setError(err?.message ?? 'Review not found')
        setLoading(false)
      })
  }, [id])

  // ── CodeMirror language extension ────────────────────────────────────────────

  const langExtension = useMemo(() => {
    if (!review) return []
    const ext = loadLanguage(review.language as LanguageName)
    return ext ? [ext] : []
  }, [review?.language])

  // ── Filter logic ─────────────────────────────────────────────────────────────

  const issues = review?.issues ?? []

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      if (sevFilter.size > 0 && !sevFilter.has(issue.severity)) return false
      if (catFilter.size > 0 && !catFilter.has(issue.category)) return false
      return true
    })
  }, [issues, sevFilter, catFilter])

  function toggleSev(sev: IssueSeverity) {
    setSevFilter((prev) => {
      const next = new Set(prev)
      next.has(sev) ? next.delete(sev) : next.add(sev)
      return next
    })
  }

  function toggleCat(cat: IssueCategory) {
    setCatFilter((prev) => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  function clearFilters() {
    setSevFilter(new Set())
    setCatFilter(new Set())
  }

  const hasFilters = sevFilter.size > 0 || catFilter.size > 0

  // ── Issue expand/collapse ────────────────────────────────────────────────────

  function toggleExpanded(issueId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(issueId) ? next.delete(issueId) : next.add(issueId)
      return next
    })
  }

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // ── Error / not found ─────────────────────────────────────────────────────────

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

  // ── Redirect if not yet complete ──────────────────────────────────────────────

  if (review.status !== 'COMPLETED') {
    return <Navigate to={ROUTES.REVIEW_STATUS(review.id)} replace />
  }

  // ── Derived values ─────────────────────────────────────────────────────────────

  const score       = review.overallScore ?? 0
  const grade       = getGrade(score)
  const issueCount  = issues.length
  const criticalCount = issues.filter((i) => i.severity === 'CRITICAL').length

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">

      {/* ── Page header ── */}
      <div>
        {/* Breadcrumb */}
        <div className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
          <button
            onClick={() => navigate(ROUTES.REVIEWS)}
            className="hover:text-foreground transition-colors"
          >
            Reviews
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground truncate max-w-[260px]">
            {review.title ?? 'Untitled Review'}
          </span>
        </div>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">
              {review.title ?? 'Untitled Review'}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="capitalize text-xs">
                {review.language}
              </Badge>
              <Badge variant="success" className="text-xs">
                Completed
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </div>
          </div>

          {/* Export placeholder (Step 16) */}
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled
            title="Export (coming in Step 16)"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summary">
            Summary
          </TabsTrigger>
          <TabsTrigger value="issues">
            Issues
            {issueCount > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground data-[state=active]:bg-background">
                {issueCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>

        {/* ══ Summary tab ══════════════════════════════════════════════════════ */}
        <TabsContent value="summary" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">

            {/* Score card */}
            <Card className="flex items-center justify-center py-6 sm:col-span-1">
              <CardContent className="p-0">
                {review.overallScore != null
                  ? <ScoreRing score={review.overallScore} />
                  : (
                    <div className="text-center text-muted-foreground">
                      <p className="text-sm">Score not available</p>
                    </div>
                  )
                }
              </CardContent>
            </Card>

            {/* Quick stats */}
            <Card className="sm:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Analysis Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {review.summary && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {review.summary}
                  </p>
                )}

                {issueCount === 0 ? (
                  <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
                    <PartyPopper className="h-4 w-4 shrink-0" />
                    No issues found — excellent code!
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{issueCount}</span>{' '}
                      {issueCount === 1 ? 'issue' : 'issues'} found
                    </span>
                    {criticalCount > 0 && (
                      <span className="text-destructive font-medium">
                        {criticalCount} critical
                      </span>
                    )}
                  </div>
                )}

                {/* Grade explainer */}
                <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                  <span className={cn('text-xl font-bold', GRADE_TEXT[grade])}>{grade}</span>
                  <div className="text-xs text-muted-foreground">
                    {{
                      A: 'Excellent — production-ready code',
                      B: 'Good — minor improvements possible',
                      C: 'Fair — several issues to address',
                      D: 'Poor — significant issues found',
                      F: 'Critical — major problems need fixing',
                    }[grade]}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Severity breakdown */}
          {issueCount > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">By Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <SeverityBreakdown issues={issues} />
              </CardContent>
            </Card>
          )}

          {/* Category breakdown */}
          {issueCount > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">By Category</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBreakdown issues={issues} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ══ Issues tab ═══════════════════════════════════════════════════════ */}
        <TabsContent value="issues" className="mt-4 space-y-4">

          {issueCount === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border py-16 text-center">
              <PartyPopper className="h-10 w-10 text-green-500" />
              <div>
                <p className="font-semibold text-foreground">No issues found</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Your code looks great!</p>
              </div>
            </div>
          ) : (
            <>
              {/* Filter bar */}
              <div className="space-y-2.5 rounded-lg border border-border bg-muted/20 p-3">
                {/* Severity filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-muted-foreground w-16">
                    Severity
                  </span>
                  <FilterChip
                    label="All"
                    active={sevFilter.size === 0}
                    onToggle={() => setSevFilter(new Set())}
                  />
                  {SEVERITY_ORDER.map((sev) => {
                    const count = issues.filter((i) => i.severity === sev).length
                    if (count === 0) return null
                    return (
                      <FilterChip
                        key={sev}
                        label={`${sev.charAt(0) + sev.slice(1).toLowerCase()} (${count})`}
                        active={sevFilter.has(sev)}
                        onToggle={() => toggleSev(sev)}
                      />
                    )
                  })}
                </div>

                {/* Category filters */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 text-xs font-medium text-muted-foreground w-16">
                    Category
                  </span>
                  <FilterChip
                    label="All"
                    active={catFilter.size === 0}
                    onToggle={() => setCatFilter(new Set())}
                  />
                  {ALL_CATEGORIES.map((cat) => {
                    const count = issues.filter((i) => i.category === cat).length
                    if (count === 0) return null
                    return (
                      <FilterChip
                        key={cat}
                        label={`${CATEGORY_META[cat].label} (${count})`}
                        active={catFilter.has(cat)}
                        onToggle={() => toggleCat(cat)}
                      />
                    )
                  })}
                </div>

                {/* Active filter indicator + clear */}
                {hasFilters && (
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-xs text-muted-foreground">
                      Showing {filteredIssues.length} of {issueCount} issues
                    </span>
                    <button
                      onClick={clearFilters}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                      Clear filters
                    </button>
                  </div>
                )}
              </div>

              {/* Issue list */}
              {filteredIssues.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No issues match the selected filters.
                </p>
              ) : (
                <div className="space-y-2">
                  {/* Sorted: CRITICAL → HIGH → MEDIUM → LOW */}
                  {[...filteredIssues]
                    .sort(
                      (a, b) =>
                        SEVERITY_ORDER.indexOf(a.severity) -
                        SEVERITY_ORDER.indexOf(b.severity),
                    )
                    .map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        expanded={expandedIds.has(issue.id)}
                        onToggle={() => toggleExpanded(issue.id)}
                      />
                    ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ══ Code tab ═════════════════════════════════════════════════════════ */}
        <TabsContent value="code" className="mt-4">
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-border py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode2 className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">
                    Submitted Code
                  </CardTitle>
                </div>
                <Badge variant="outline" className="capitalize text-xs">
                  {review.language}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <CodeMirror
                value={review.code}
                height="600px"
                extensions={langExtension}
                theme={theme === 'dark' ? 'dark' : 'light'}
                editable={false}
                readOnly
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: false,
                  highlightSelectionMatches: true,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
