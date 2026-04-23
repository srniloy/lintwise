import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  BarChart3,
  Crown,
  FileCode2,
  Languages as LanguagesIcon,
  Plus,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { ROUTES } from '@/constants/routes'
import { reviewService } from '@/services/reviewService'
import { useAuth } from '@/hooks/useAuth'
import type { Issue, IssueCategory, Review } from '@/types/review'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Date range ────────────────────────────────────────────────────────────────

type DateRange = '7d' | '30d' | '90d' | 'all'

const RANGE_LABEL: Record<DateRange, string> = {
  '7d':  'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all:   'All time',
}

function rangeCutoff(range: DateRange): Date | null {
  if (range === 'all') return null
  const days = { '7d': 7, '30d': 30, '90d': 90 }[range]
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

// ── Category meta ─────────────────────────────────────────────────────────────

const CATEGORY_META: Record<IssueCategory, { label: string; color: string }> = {
  SECURITY:      { label: 'Security',      color: '#ef4444' },
  PERFORMANCE:   { label: 'Performance',   color: '#f97316' },
  QUALITY:       { label: 'Quality',       color: '#eab308' },
  STYLE:         { label: 'Style',         color: '#8b5cf6' },
  DOCUMENTATION: { label: 'Documentation', color: '#3b82f6' },
  TESTING:       { label: 'Testing',       color: '#10b981' },
  DEPENDENCIES:  { label: 'Dependencies',  color: '#06b6d4' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfMonth(d: Date): Date {
  const m = new Date(d)
  m.setDate(1)
  m.setHours(0, 0, 0, 0)
  return m
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ── Stat tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  hint,
  Icon,
  accent,
}: {
  label: string
  value: string | number
  hint?: string
  Icon: React.ComponentType<{ className?: string }>
  accent?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            accent ?? 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-bold text-foreground leading-tight">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Donut chart (issues by category) ──────────────────────────────────────────

interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
}

function DonutChart({ slices }: { slices: DonutSlice[] }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)

  if (total === 0) {
    return (
      <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No issues in this range</p>
      </div>
    )
  }

  const size = 200
  const cx = size / 2
  const cy = size / 2
  const r = 78
  const stroke = 22
  const circ = 2 * Math.PI * r

  let cumulative = 0
  const arcs = slices.map((s) => {
    const pct = s.value / total
    const length = circ * pct
    const offset = circ * cumulative
    cumulative += pct
    return { ...s, length, offset, pct }
  })

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div className="relative shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted/40"
          />
          {/* Arcs */}
          {arcs.map((a) => (
            <circle
              key={a.key}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={stroke}
              strokeDasharray={`${a.length} ${circ - a.length}`}
              strokeDashoffset={-a.offset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-foreground leading-none">{total}</span>
          <span className="mt-0.5 text-xs text-muted-foreground">total issues</span>
        </div>
      </div>

      {/* Legend */}
      <ul className="flex-1 space-y-1.5 text-sm">
        {arcs.map((a) => (
          <li key={a.key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: a.color }}
              aria-hidden
            />
            <span className="flex-1 truncate text-foreground">{a.label}</span>
            <span className="shrink-0 text-muted-foreground">{a.value}</span>
            <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
              {Math.round(a.pct * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Line chart (score trend) ──────────────────────────────────────────────────

interface TrendPoint {
  date: Date
  score: number
}

function LineChart({ points }: { points: TrendPoint[] }) {
  const width = 640
  const height = 200
  const padL = 36
  const padR = 12
  const padT = 12
  const padB = 28
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  if (points.length === 0) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No completed reviews yet</p>
      </div>
    )
  }

  const minT = points[0].date.getTime()
  const maxT = points[points.length - 1].date.getTime()
  const span = Math.max(1, maxT - minT)

  const xOf = (d: Date) =>
    points.length === 1 ? padL + plotW / 2 : padL + ((d.getTime() - minT) / span) * plotW

  const yOf = (score: number) => padT + (1 - score / 100) * plotH

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(p.date).toFixed(2)} ${yOf(p.score).toFixed(2)}`)
    .join(' ')

  const areaPath =
    `${path} L ${xOf(points[points.length - 1].date).toFixed(2)} ${padT + plotH} ` +
    `L ${xOf(points[0].date).toFixed(2)} ${padT + plotH} Z`

  // Axis labels (5 y-ticks: 0, 25, 50, 75, 100)
  const yTicks = [0, 25, 50, 75, 100]

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ maxHeight: 240 }}
      >
        {/* Grid */}
        {yTicks.map((t) => {
          const y = yOf(t)
          return (
            <g key={t}>
              <line
                x1={padL} x2={width - padR} y1={y} y2={y}
                stroke="currentColor" strokeDasharray="2 3"
                className="text-muted/40"
              />
              <text
                x={padL - 6} y={y + 3}
                textAnchor="end"
                className="fill-muted-foreground text-[10px]"
              >
                {t}
              </text>
            </g>
          )
        })}

        {/* Area fill */}
        <path d={areaPath} fill="hsl(var(--primary))" fillOpacity="0.12" />

        {/* Line */}
        <path
          d={path}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={xOf(p.date)} cy={yOf(p.score)}
            r={3}
            fill="hsl(var(--primary))"
          >
            <title>{`${p.date.toLocaleDateString()}: ${p.score}`}</title>
          </circle>
        ))}

        {/* X labels (first + last) */}
        <text
          x={padL} y={height - 8}
          textAnchor="start"
          className="fill-muted-foreground text-[10px]"
        >
          {formatShortDate(points[0].date)}
        </text>
        {points.length > 1 && (
          <text
            x={width - padR} y={height - 8}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {formatShortDate(points[points.length - 1].date)}
          </text>
        )}
      </svg>
    </div>
  )
}

// ── Bar chart (languages) ─────────────────────────────────────────────────────

interface BarRow {
  label: string
  value: number
}

function BarChart({ rows }: { rows: BarRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-center">
        <LanguagesIcon className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No languages in this range</p>
      </div>
    )
  }

  const max = Math.max(1, ...rows.map((r) => r.value))

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const pct = (r.value / max) * 100
        return (
          <div key={r.label} className="flex items-center gap-3">
            <div className="w-24 shrink-0 truncate text-sm capitalize text-muted-foreground">
              {r.label}
            </div>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs font-medium text-foreground">
                {r.value}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, isPremium } = useAuth()

  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<DateRange>('30d')

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    reviewService
      .list({ limit: 100 })
      .then((res) => { setReviews(res.reviews); setLoading(false) })
      .catch((err: { message?: string }) => {
        setError(err?.message ?? 'Failed to load dashboard data')
        setLoading(false)
      })
  }, [])

  // ── Filter by date range ──────────────────────────────────────────────────
  const inRange = useMemo(() => {
    const cutoff = rangeCutoff(range)
    if (!cutoff) return reviews
    return reviews.filter((r) => new Date(r.createdAt) >= cutoff)
  }, [reviews, range])

  // ── Derived personal stats ────────────────────────────────────────────────
  const totalReviews = reviews.length
  const thisMonthCount = useMemo(() => {
    const som = startOfMonth(new Date())
    return reviews.filter((r) => new Date(r.createdAt) >= som).length
  }, [reviews])

  const completedInRange = useMemo(
    () => inRange.filter((r) => r.status === 'COMPLETED'),
    [inRange],
  )

  const avgScore = useMemo(() => {
    const scored = completedInRange.filter((r) => r.overallScore != null)
    if (scored.length === 0) return null
    const sum = scored.reduce((s, r) => s + (r.overallScore ?? 0), 0)
    return Math.round(sum / scored.length)
  }, [completedInRange])

  const totalIssues = useMemo(
    () => completedInRange.reduce((s, r) => s + (r.issues?.length ?? 0), 0),
    [completedInRange],
  )

  // ── Donut: issues by category ─────────────────────────────────────────────
  const categorySlices = useMemo<DonutSlice[]>(() => {
    const counts: Partial<Record<IssueCategory, number>> = {}
    completedInRange.forEach((r) =>
      r.issues?.forEach((i: Issue) => {
        counts[i.category] = (counts[i.category] ?? 0) + 1
      }),
    )
    return (Object.keys(CATEGORY_META) as IssueCategory[])
      .map((cat) => ({
        key: cat,
        label: CATEGORY_META[cat].label,
        value: counts[cat] ?? 0,
        color: CATEGORY_META[cat].color,
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [completedInRange])

  // ── Line: score trend ─────────────────────────────────────────────────────
  const trendPoints = useMemo<TrendPoint[]>(() => {
    return completedInRange
      .filter((r) => r.overallScore != null)
      .map((r) => ({
        date: new Date(r.createdAt),
        score: r.overallScore as number,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [completedInRange])

  // ── Bar: languages ────────────────────────────────────────────────────────
  const languageRows = useMemo<BarRow[]>(() => {
    const counts = new Map<string, number>()
    inRange.forEach((r) => counts.set(r.language, (counts.get(r.language) ?? 0) + 1))
    return Array.from(counts.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [inRange])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="font-semibold text-foreground">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  if (totalReviews === 0) {
    return (
      <div className="mx-auto max-w-5xl space-y-5 p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your analytics will appear here once you submit your first review.
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <FileCode2 className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="font-semibold text-foreground">No reviews yet</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Submit code for your first AI-powered review to see insights here.
              </p>
            </div>
            <Button onClick={() => navigate(ROUTES.REVIEW_NEW)}>
              <Plus className="h-4 w-4" />
              New Review
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Your code review activity at a glance · {RANGE_LABEL[range]}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-36">
            <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={() => navigate(ROUTES.REVIEW_NEW)}>
            <Plus className="h-4 w-4" />
            New Review
          </Button>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Total Reviews"
          value={totalReviews}
          hint="All time"
          Icon={FileCode2}
        />
        <StatTile
          label="This Month"
          value={thisMonthCount}
          hint={`${thisMonthCount === 1 ? 'review' : 'reviews'} submitted`}
          Icon={BarChart3}
          accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatTile
          label="Avg. Score"
          value={avgScore ?? '—'}
          hint={avgScore != null ? 'out of 100' : 'No completed reviews'}
          Icon={TrendingUp}
          accent="bg-green-500/10 text-green-600 dark:text-green-400"
        />
        <StatTile
          label="Issues Found"
          value={totalIssues}
          hint={RANGE_LABEL[range]}
          Icon={Sparkles}
          accent="bg-orange-500/10 text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* Score trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Code Quality Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart points={trendPoints} />
        </CardContent>
      </Card>

      {/* Category donut + Language bars */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Issues by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart slices={categorySlices} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Languages Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart rows={languageRows} />
          </CardContent>
        </Card>
      </div>

      {/* Team stats (premium) */}
      {isPremium ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-yellow-500" />
              Team Insights
              <Badge variant="secondary" className="text-[10px] uppercase">Premium</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Team-wide analytics will appear here once your team has shared reviews. Visit the{' '}
              <button
                onClick={() => navigate(ROUTES.TEAM)}
                className="text-primary underline-offset-2 hover:underline"
              >
                Team page
              </button>{' '}
              to invite members.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-start gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Crown className="mt-0.5 h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-semibold text-foreground">Unlock team insights</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upgrade to Premium to compare your team's code quality across projects.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px] uppercase">Premium</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
