import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  BarChart3,
  Crown,
  FileCode2,
  Languages as LanguagesIcon,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ROUTES } from '@/constants/routes'
import { analyticsService } from '@/services/analyticsService'
import type {
  AnalyticsRange,
  PersonalStats,
  TeamStats,
} from '@/services/analyticsService'
import { useAuth } from '@/hooks/useAuth'
import type { IssueCategory } from '@/types/review'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
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

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGE_LABEL: Record<AnalyticsRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
}

const CATEGORY_META: Record<IssueCategory, { label: string; color: string }> = {
  SECURITY: { label: 'Security', color: '#ef4444' },
  PERFORMANCE: { label: 'Performance', color: '#f97316' },
  QUALITY: { label: 'Quality', color: '#eab308' },
  STYLE: { label: 'Style', color: '#8b5cf6' },
  DOCUMENTATION: { label: 'Documentation', color: '#3b82f6' },
  TESTING: { label: 'Testing', color: '#10b981' },
  DEPENDENCIES: { label: 'Dependencies', color: '#06b6d4' },
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
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold text-foreground leading-tight">{value}</p>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Chart configs ─────────────────────────────────────────────────────────────

const trendChartConfig = {
  score: { label: 'Quality Score', color: '#8b5cf6' },
} satisfies ChartConfig

const BAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#eab308', '#10b981', '#06b6d4', '#3b82f6',
]

// ── Donut chart (issues by category) ──────────────────────────────────────────

interface DonutSlice {
  key: string
  label: string
  value: number
  color: string
}

function DonutChart({ slices }: { slices: DonutSlice[] }) {
  if (slices.length === 0) {
    return (
      <div className="flex h-55 flex-col items-center justify-center gap-2 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No issues in this range</p>
      </div>
    )
  }

  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const pieConfig = Object.fromEntries(
    slices.map((s) => [s.key, { label: s.label, color: s.color }])
  ) satisfies ChartConfig

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <ChartContainer config={pieConfig} className="h-[200px] w-[200px] shrink-0 aspect-square">
        <PieChart>
          <Tooltip content={<ChartTooltipContent hideLabel nameKey="label" />} />
          <Pie
            data={slices}
            dataKey="value"
            nameKey="label"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            strokeWidth={0}
          >
            {slices.map((s) => (
              <Cell key={s.key} fill={s.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="flex flex-col justify-center gap-0.5 text-center sm:text-left">
        <p className="text-3xl font-bold text-foreground leading-none">{total}</p>
        <p className="mb-3 text-xs text-muted-foreground">total issues</p>
        <ul className="space-y-1.5 text-sm">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
              <span className="flex-1 truncate text-foreground">{s.label}</span>
              <span className="shrink-0 text-muted-foreground">{s.value}</span>
              <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                {Math.round((s.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── Line chart (score trend) ──────────────────────────────────────────────────

interface TrendPoint {
  date: Date
  score: number
}

function makeSampleTrend(): TrendPoint[] {
  const now = new Date()
  const day = 24 * 60 * 60 * 1000
  const scores = [62, 71, 68, 79, 84]
  return scores.map((score, i) => ({
    date: new Date(now.getTime() - (scores.length - 1 - i) * 7 * day),
    score,
  }))
}

function TrendLineChart({
  points,
  totalInRange,
}: {
  points: TrendPoint[]
  totalInRange: number
}) {
  const isSample = points.length === 0
  const renderPoints = isSample ? makeSampleTrend() : points
  const emptyMessage = isSample
    ? totalInRange === 0
      ? 'No reviews yet — showing sample data'
      : 'No completed & scored reviews yet — showing sample data'
    : null

  const data = renderPoints.map((p) => ({
    date: formatShortDate(p.date),
    score: p.score,
  }))

  return (
    <div className="relative w-full">
      {emptyMessage && (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
          <span className="rounded-full border border-dashed border-border bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
            {emptyMessage}
          </span>
        </div>
      )}
      <ChartContainer config={trendChartConfig} className="h-[200px] w-full">
        <AreaChart data={data} margin={{ top: 16, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="scoreStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            className="fill-muted-foreground"
          />
          <Tooltip
            content={<ChartTooltipContent indicator="dot" />}
            cursor={{ stroke: '#8b5cf6', strokeWidth: 1, strokeDasharray: '4 2' }}
          />
          <Area
            type="monotone"
            dataKey="score"
            stroke="url(#scoreStroke)"
            strokeWidth={3}
            fill="url(#scoreGradient)"
            dot={{ r: 4, fill: '#8b5cf6', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: '#ec4899', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            strokeDasharray={isSample ? '6 4' : undefined}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

// ── Bar chart (languages) ─────────────────────────────────────────────────────

interface BarRow {
  label: string
  value: number
}

function LangBarChart({ rows }: { rows: BarRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex h-45 flex-col items-center justify-center gap-2 text-center">
        <LanguagesIcon className="h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No languages in this range</p>
      </div>
    )
  }

  const data = rows.map((r) => ({ language: r.label, count: r.value }))
  const barConfig = Object.fromEntries(
    rows.map((r, i) => [r.label, { label: r.label, color: BAR_COLORS[i % BAR_COLORS.length] }])
  ) satisfies ChartConfig

  return (
    <ChartContainer config={barConfig} className="h-[220px] w-full">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} className="fill-muted-foreground" />
        <YAxis
          type="category"
          dataKey="language"
          width={72}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          className="fill-muted-foreground capitalize"
        />
        <Tooltip content={<ChartTooltipContent indicator="dot" />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user, isPremium } = useAuth()

  const [range, setRange] = useState<AnalyticsRange>('30d')

  const [stats, setStats] = useState<PersonalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamError, setTeamError] = useState<string | null>(null)

  // ── Fetch personal stats ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    analyticsService
      .getPersonal(range)
      .then((data) => {
        if (!cancelled) {
          setStats(data)
          setLoading(false)
        }
      })
      .catch((err: { message?: string }) => {
        if (!cancelled) {
          setError(err?.message ?? 'Failed to load analytics')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [range, reloadKey])

  // ── Fetch team stats (premium only) ───────────────────────────────────────
  useEffect(() => {
    if (!isPremium) {
      setTeamStats(null)
      setTeamError(null)
      return
    }
    let cancelled = false
    setTeamLoading(true)
    setTeamError(null)
    analyticsService
      .getTeam(range)
      .then((data) => {
        if (!cancelled) {
          setTeamStats(data)
          setTeamLoading(false)
        }
      })
      .catch((err: { message?: string; statusCode?: number }) => {
        if (!cancelled) {
          setTeamStats(null)
          // 404 just means "no team yet" — not an error worth surfacing loudly
          setTeamError(err?.statusCode === 404 ? null : (err?.message ?? 'Failed to load team analytics'))
          setTeamLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [range, isPremium, reloadKey])

  // ── Derived chart data ────────────────────────────────────────────────────
  const donutSlices = useMemo<DonutSlice[]>(() => {
    if (!stats) return []
    return (Object.keys(CATEGORY_META) as IssueCategory[])
      .map((cat) => ({
        key: cat,
        label: CATEGORY_META[cat].label,
        value: stats.issuesByCategory[cat] ?? 0,
        color: CATEGORY_META[cat].color,
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value)
  }, [stats])

  const trendPoints = useMemo<TrendPoint[]>(() => {
    if (!stats) return []
    return stats.scoreTrend
      .map((p) => ({ date: new Date(p.date), score: p.score }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [stats])

  const languageRows = useMemo<BarRow[]>(() => {
    if (!stats) return []
    return stats.languages.slice(0, 8).map((l) => ({ label: l.language, value: l.count }))
  }, [stats])

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full max-w-480 space-y-5 p-8">
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
  if (error || !stats) {
    return (
      <div className=" flex min-h-[60vh] w-full max-w-480 flex-col items-center justify-center gap-3 p-8 text-center">
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
  if (stats.totalReviews === 0) {
    return (
      <div className="w-full max-w-480 space-y-5 p-8">
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
    <div className="w-full max-w-480 space-y-5 p-8">

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
            <Select value={range} onValueChange={(v) => setRange(v as AnalyticsRange)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReloadKey((k) => k + 1)}
            aria-label="Refresh analytics"
            title="Refresh analytics"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
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
          value={stats.totalReviews}
          hint="All time"
          Icon={FileCode2}
        />
        <StatTile
          label="This Month"
          value={stats.thisMonthReviews}
          hint={`${stats.thisMonthReviews === 1 ? 'review' : 'reviews'} submitted`}
          Icon={BarChart3}
          accent="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        />
        <StatTile
          label="Avg. Score"
          value={stats.averageScore ?? '—'}
          hint={stats.averageScore != null ? 'out of 100' : 'No completed reviews'}
          Icon={TrendingUp}
          accent="bg-green-500/10 text-green-600 dark:text-green-400"
        />
        <StatTile
          label="Issues Found"
          value={donutSlices.reduce((sum, s) => sum + s.value, 0)}
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
          <TrendLineChart
            points={trendPoints}
            totalInRange={stats.languages.reduce((sum, l) => sum + l.count, 0)}
          />
        </CardContent>
      </Card>

      {/* Category donut + Language bars */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Issues by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart slices={donutSlices} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Languages Reviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <LangBarChart rows={languageRows} />
          </CardContent>
        </Card>
      </div>

      {/* Team stats (premium) */}
      {isPremium && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className="h-4 w-4 text-yellow-500" />
              Team Insights
              <Badge variant="secondary" className="text-[10px] uppercase">Premium</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : teamError ? (
              <p className="text-sm text-destructive">{teamError}</p>
            ) : !teamStats || teamStats.teamId == null ? (
              <p className="text-sm text-muted-foreground">
                You're not in a team yet. Visit the{' '}
                <button
                  onClick={() => navigate(ROUTES.TEAM)}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  Team page
                </button>{' '}
                to create or join one.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Team stat tiles */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      Members
                    </div>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {teamStats.memberCount}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileCode2 className="h-3.5 w-3.5" />
                      Reviews
                    </div>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {teamStats.totalReviews}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Avg. Score
                    </div>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {teamStats.averageScore ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Sparkles className="h-3.5 w-3.5" />
                      Issues
                    </div>
                    <p className="mt-1 text-xl font-bold text-foreground">
                      {Object.values(teamStats.issuesByCategory).reduce((s, n) => s + n, 0)}
                    </p>
                  </div>
                </div>

                {/* Top contributors */}
                {teamStats.topContributors.length > 0 && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                      <Trophy className="h-3.5 w-3.5 text-yellow-500" />
                      Top Contributors
                    </p>
                    <ul className="space-y-1.5">
                      {teamStats.topContributors.slice(0, 5).map((c, i) => (
                        <li
                          key={c.userId}
                          className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="flex-1 truncate text-sm text-foreground">{c.name}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {c.reviewCount} {c.reviewCount === 1 ? 'review' : 'reviews'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isPremium && (
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
