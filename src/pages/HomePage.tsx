import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/constants/routes'
import {
  Code2,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe,
  Bug,
  Layers,
  FileCode2,
  Bot,
  Users,
  Webhook,
  BarChart3,
  Lock,
  CheckCircle2,
  ArrowRight,
  Star,
  Menu,
  X,
  SearchCode,
  Workflow,
  AlertTriangle,
} from 'lucide-react'

// Soft-dark palette (lighter than the default near-black) + light palette via `dark:` variants.
const PAGE = 'bg-white dark:bg-[#161616]'
const PAGE_ALT = 'bg-slate-50 dark:bg-[#1c1c1c]'
const CARD = 'bg-white dark:bg-[#242424]'
const BORDER = 'border-slate-200 dark:border-white/10'
const TEXT = 'text-slate-900 dark:text-slate-100'
const TEXT_MUTED = 'text-slate-600 dark:text-slate-400'
const TEXT_MUTED_SOFT = 'text-slate-500 dark:text-slate-400'
const HOVER_BG = 'hover:bg-slate-100 dark:hover:bg-white/5'
const HOVER_TEXT = 'hover:text-slate-900 dark:hover:text-white'

// ─── Data ──────────────────────────────────────────────────────────────────────
const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: ROUTES.UPGRADE },
  { label: 'For Teams', href: '#for-teams' },
]

const features = [
  {
    icon: Bot,
    title: 'AI-Powered Analysis',
    desc: 'Context-aware reviews that understand your code, not just syntax. Catch real bugs, not just style nits.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: Globe,
    title: '50+ Languages',
    desc: 'From TypeScript and Python to Go and Rust, review code across your entire polyglot stack.',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
  },
  {
    icon: Zap,
    title: 'Real-Time Status',
    desc: 'Track every review live: PENDING → PROCESSING → COMPLETED, with results the moment they are ready.',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    icon: Bug,
    title: '7 Issue Categories',
    desc: 'Security, performance, quality, style, documentation, testing and dependency issues, all classified.',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
  {
    icon: Layers,
    title: 'Snippets & Collections',
    desc: 'Save reusable snippets, organize them into collections, and share them with your team.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: FileCode2,
    title: 'Export Anywhere',
    desc: 'Download reviews as PDF, JSON, Markdown or CSV and drop them straight into your workflow.',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
]

const steps = [
  {
    step: '01',
    icon: Code2,
    title: 'Paste or upload your code',
    desc: 'Submit up to 10,000 lines or 5 files at once. LintWise supports snippets, full modules, and diffs.',
  },
  {
    step: '02',
    icon: SearchCode,
    title: 'AI reviews it instantly',
    desc: 'Our model analyzes structure, logic, and security in seconds and groups findings by severity and category.',
  },
  {
    step: '03',
    icon: CheckCircle2,
    title: 'Fix, export & ship',
    desc: 'Apply suggestions, export the report, or push it to your team. Cleaner code, merged with confidence.',
  },
]

const teamBenefits = [
  {
    icon: Users,
    title: 'Team Collaboration',
    desc: 'Invite up to 50 members, share reviews, and run threaded comments with @mentions on every finding.',
  },
  {
    icon: Webhook,
    title: 'Webhooks & REST API',
    desc: 'Plug reviews into CI/CD. Get REVIEW_COMPLETED and CRITICAL_ISSUE_FOUND events delivered to your stack.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Reports',
    desc: 'Track code health across the org with team dashboards, trends, and downloadable reports.',
  },
]

const trustPoints = [
  {
    icon: Lock,
    title: 'Your Code Stays Yours',
    desc: 'Code is encrypted in transit and at rest. We never train on your private repositories.',
  },
  {
    icon: ShieldCheck,
    title: 'Enterprise Grade',
    desc: 'Hardened authentication, rate limiting, and audit-ready access controls on every request.',
  },
  {
    icon: Workflow,
    title: 'Compliant by Design',
    desc: 'Aligned with GDPR, CCPA and SOC 2 Type II practices so reviews meet your security bar.',
  },
]

const compliance = ['SOC 2 Type II', 'GDPR', 'CCPA', 'TLS 1.3', 'AES-256', 'OWASP Top 10']

const footerCols = {
  Product: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: ROUTES.UPGRADE },
    { label: 'For Teams', href: '#for-teams' },
    { label: 'Dashboard', href: ROUTES.DASHBOARD },
  ],
  Resources: [
    { label: 'Documentation', href: '#' },
    { label: 'API Reference', href: '#' },
    { label: 'Status', href: '#' },
    { label: 'Changelog', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Contact', href: '#' },
    { label: 'Careers', href: '#' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Security', href: '#' },
  ],
}

// ─── Root Component ────────────────────────────────────────────────────────────
export default function HomePage() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { isAuthenticated } = useAuth()

  return (
    <div className={cn('min-h-screen', PAGE, TEXT)}>
      <Navbar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        isAuthenticated={isAuthenticated}
      />
      <main>
        <HeroSection isAuthenticated={isAuthenticated} />
        <StatsBar />
        <FeaturesSection />
        <HowItWorksSection />
        <TeamSection />
        <TrustSection />
        <CtaSection isAuthenticated={isAuthenticated} />
      </main>
      <Footer />
    </div>
  )
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
function Navbar({
  mobileOpen,
  setMobileOpen,
  isAuthenticated,
}: {
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
  isAuthenticated: boolean
}) {
  return (
    <header className={cn('sticky top-0 z-50 border-b backdrop-blur-lg', BORDER, 'bg-white/85 dark:bg-[#161616]/85')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to={ROUTES.DASHBOARD} className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Code2 className="size-5" />
          </span>
          <span className="text-lg font-bold tracking-tight">LintWise</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {navLinks.map((l) =>
            l.href.startsWith('#') ? (
              <a
                key={l.label}
                href={l.href}
                className={cn('text-sm font-medium transition-colors', TEXT_MUTED, 'hover:text-primary')}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                to={l.href}
                className={cn('text-sm font-medium transition-colors', TEXT_MUTED, 'hover:text-primary')}
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>

        {/* Auth actions */}
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button asChild>
              <Link to={ROUTES.DASHBOARD}>
                Go to Dashboard
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Link
                to={ROUTES.LOGIN}
                className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-colors', TEXT_MUTED, HOVER_BG, HOVER_TEXT)}
              >
                Log in
              </Link>
              <Button asChild>
                <Link to={ROUTES.REGISTER}>
                  Get started
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            aria-label="Toggle menu"
            className={cn('rounded-lg p-2 transition-colors', TEXT_MUTED, HOVER_BG)}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className={cn('border-t md:hidden', BORDER, CARD)}>
          <div className="space-y-1 px-4 py-5">
            {navLinks.map((l) =>
              l.href.startsWith('#') ? (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn('block rounded-lg px-3 py-2.5 text-sm font-medium', HOVER_BG, HOVER_TEXT)}
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.label}
                  to={l.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn('block rounded-lg px-3 py-2.5 text-sm font-medium', HOVER_BG, HOVER_TEXT)}
                >
                  {l.label}
                </Link>
              ),
            )}
            <div className={cn('mt-3 flex flex-col gap-2 border-t pt-3', BORDER)}>
              {isAuthenticated ? (
                <Button asChild className="w-full">
                  <Link to={ROUTES.DASHBOARD} onClick={() => setMobileOpen(false)}>
                    Go to Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Link
                    to={ROUTES.LOGIN}
                    onClick={() => setMobileOpen(false)}
                    className={cn('rounded-lg border py-2.5 text-center text-sm font-medium transition-colors', BORDER, HOVER_BG)}
                  >
                    Log in
                  </Link>
                  <Button asChild className="w-full">
                    <Link to={ROUTES.REGISTER} onClick={() => setMobileOpen(false)}>
                      Get started
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
function HeroSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.07] via-transparent to-transparent dark:from-primary/[0.10]">
      {/* Ambient blobs */}
      <div className="pointer-events-none absolute inset-0 select-none" aria-hidden>
        <div className="absolute -right-40 -top-40 size-[600px] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-32 top-1/3 size-[420px] rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 lg:grid-cols-2 lg:gap-16 lg:py-28">
        {/* Copy */}
        <div className="max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            AI-Powered Code Review
          </span>

          <h1 className={cn('text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl', TEXT)}>
            Smarter code reviews.
            <br />
            <span className="text-primary">Zero busywork.</span>
          </h1>

          <p className={cn('mt-6 text-lg leading-relaxed', TEXT_MUTED)}>
            LintWise reviews your code across 50+ languages in seconds, surfacing security
            flaws, performance issues, and style problems so your team can focus on building.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.REGISTER}>
                {isAuthenticated ? 'Open Dashboard' : 'Start reviewing free'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={ROUTES.UPGRADE}>See pricing</Link>
            </Button>
          </div>

          {/* Social proof */}
          <div className="mt-10 flex items-center gap-4">
            <div className="flex -space-x-2.5">
              {['JD', 'AK', 'MR', 'SL'].map((initial) => (
                <div
                  key={initial}
                  className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-primary/15 text-xs font-bold text-primary dark:border-[#161616]"
                >
                  {initial}
                </div>
              ))}
            </div>
            <div>
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-1.5 text-sm font-semibold">4.9</span>
              </div>
              <p className={cn('text-xs', TEXT_MUTED_SOFT)}>Trusted by 12,000+ developers</p>
            </div>
          </div>
        </div>

        {/* Review mockup */}
        <div className="relative flex animate-in fade-in slide-in-from-bottom-8 duration-700 items-center">
          <ReviewMockup />
        </div>
      </div>
    </section>
  )
}

function ReviewMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Glow */}
      <div className="absolute -inset-6 -z-10 rounded-3xl bg-primary/10 blur-2xl" />

      <div className={cn('overflow-hidden rounded-2xl border shadow-2xl', BORDER, CARD)}>
        {/* Window header */}
        <div className={cn('flex items-center justify-between border-b px-4 py-3 bg-slate-50 dark:bg-white/5', BORDER)}>
          <div className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-rose-400/70" />
            <span className="size-3 rounded-full bg-amber-400/70" />
            <span className="size-3 rounded-full bg-emerald-400/70" />
          </div>
          <span className={cn('font-mono text-xs', TEXT_MUTED_SOFT)}>auth.service.ts</span>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            Reviewed
          </span>
        </div>

        {/* Code body */}
        <div className="space-y-1 p-4 font-mono text-[12px] leading-relaxed">
          <p className={cn(TEXT_MUTED)}>
            <span className="text-primary">async function</span> login(user) {'{'}
          </p>
          <p className="pl-4 text-slate-500 dark:text-slate-400">const token = sign(user.id)</p>
          <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-rose-500" />
            <span className="text-slate-700 dark:text-slate-200">
              <span className="text-rose-500">⚠</span> Hardcoded secret - use env vars
            </span>
          </div>
          <p className="pl-4 text-slate-500 dark:text-slate-400">return token</p>
          <p className={cn(TEXT_MUTED)}>{'}'}</p>
        </div>

        {/* Issue summary */}
        <div className={cn('grid grid-cols-3 divide-x border-t', BORDER, 'divide-slate-200 dark:divide-white/10')}>
          {[
            { label: 'Security', value: '3', color: 'text-rose-500' },
            { label: 'Performance', value: '1', color: 'text-amber-500' },
            { label: 'Style', value: '5', color: 'text-sky-500' },
          ].map((s) => (
            <div key={s.label} className="px-3 py-3 text-center">
              <p className={cn('text-lg font-extrabold', s.color)}>{s.value}</p>
              <p className={cn('text-[10px] font-medium', TEXT_MUTED_SOFT)}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Floating chip */}
      <div className={cn('absolute -right-4 top-10 flex items-center gap-2 rounded-xl border px-3 py-2 shadow-lg', BORDER, CARD)}>
        <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
        <span className="text-xs font-medium">AI scan complete</span>
      </div>
    </div>
  )
}

// ─── Stats ─────────────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { value: '2M+', label: 'Lines reviewed' },
    { value: '50+', label: 'Languages' },
    { value: '10k+', label: 'Issues caught' },
    { value: '99.9%', label: 'Uptime SLA' },
  ]

  return (
    <section className={cn('border-y', BORDER, PAGE_ALT)}>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:px-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-3xl font-extrabold tracking-tight text-primary">{s.value}</p>
            <p className={cn('mt-1 text-sm font-medium', TEXT_MUTED_SOFT)}>{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Features ──────────────────────────────────────────────────────────────────
function FeaturesSection() {
  return (
    <section id="features" className={cn('py-24 lg:py-32', PAGE)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            Why LintWise
          </span>
          <h2 className={cn('mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl', TEXT)}>
            Everything you need for modern reviews
          </h2>
          <p className={cn('mx-auto mt-4 max-w-2xl text-lg', TEXT_MUTED)}>
            From intelligent analysis to exports and team workflows - one platform for every
            commit your team ships.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className={cn(
                'group rounded-2xl border p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg',
                BORDER,
                CARD,
              )}
            >
              <div className={cn('mb-5 flex size-12 items-center justify-center rounded-xl', f.bg)}>
                <f.icon className={cn('size-6', f.color)} />
              </div>
              <h3 className={cn('mb-2 text-base font-bold leading-snug', TEXT)}>{f.title}</h3>
              <p className={cn('text-sm leading-relaxed', TEXT_MUTED)}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How it works ──────────────────────────────────────────────────────────────
function HowItWorksSection() {
  return (
    <section id="how-it-works" className={cn('py-24 lg:py-32', PAGE_ALT)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-primary">
            How it works
          </span>
          <h2 className={cn('mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl', TEXT)}>
            From code to confidence in three steps
          </h2>
          <p className={cn('mx-auto mt-4 max-w-2xl text-lg', TEXT_MUTED)}>
            No setup, no config. Paste your code and let LintWise do the heavy lifting.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 lg:gap-12">
          {steps.map((s, i) => (
            <div
              key={s.title}
              className={cn('relative rounded-2xl border p-8 shadow-sm', BORDER, CARD)}
            >
              <div className="absolute right-6 top-5 select-none text-8xl font-extrabold leading-none text-primary/5">
                {s.step}
              </div>
              <div className="relative z-10 mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <s.icon className="size-6 text-primary" />
              </div>
              <span className="mb-3 inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                Step {i + 1}
              </span>
              <h3 className={cn('mb-2 text-lg font-bold leading-snug', TEXT)}>{s.title}</h3>
              <p className={cn('text-sm leading-relaxed', TEXT_MUTED)}>{s.desc}</p>

              {i < 2 && (
                <div className="absolute left-full top-1/2 ml-2 hidden size-8 -translate-y-1/2 items-center justify-center lg:flex">
                  <ArrowRight className="size-4 text-slate-300 dark:text-slate-600" />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Button asChild size="lg">
            <Link to={ROUTES.REVIEW_NEW}>
              Start a review
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

// ─── Team / Premium ────────────────────────────────────────────────────────────
function TeamSection() {
  return (
    <section id="for-teams" className={cn('py-24 lg:py-32', PAGE)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
          {/* Mockup */}
          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-full bg-primary/10 blur-3xl" />
            <div className={cn('rounded-3xl border p-6 shadow-2xl', BORDER, CARD)}>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className={cn('mb-0.5 text-xs font-medium', TEXT_MUTED_SOFT)}>Team health</p>
                  <p className={cn('text-3xl font-extrabold tracking-tight', TEXT)}>A+ rating</p>
                </div>
                <div className="flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <BarChart3 className="size-5 text-emerald-500" />
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { label: 'Security issues', value: '12', trend: '-38%', up: false },
                  { label: 'Reviews this week', value: '184', trend: '+22%', up: true },
                  { label: 'Avg. resolution', value: '1.4d', trend: '-12%', up: false },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/5"
                  >
                    <span className={cn('text-sm font-medium', TEXT_MUTED_SOFT)}>{row.label}</span>
                    <div className="flex items-center gap-3">
                      <span className={cn('text-sm font-bold', TEXT)}>{row.value}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          row.up
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-primary/10 text-primary',
                        )}
                      >
                        {row.trend}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Copy */}
          <div>
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">
              For Teams
            </span>
            <h2 className={cn('mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl', TEXT)}>
              Scale reviews across your whole team
            </h2>
            <p className={cn('mt-4 leading-relaxed', TEXT_MUTED)}>
              LintWise Premium brings collaboration, automation, and analytics so every engineer
              ships safer code - without adding process overhead.
            </p>

            <div className="mt-10 space-y-7">
              {teamBenefits.map((b) => (
                <div key={b.title} className="flex gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <b.icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <h3 className={cn('mb-1 font-bold leading-snug', TEXT)}>{b.title}</h3>
                    <p className={cn('text-sm leading-relaxed', TEXT_MUTED)}>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10">
              <Button asChild size="lg">
                <Link to={ROUTES.UPGRADE}>
                  Upgrade to Premium
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Trust / Security ──────────────────────────────────────────────────────────
function TrustSection() {
  return (
    <section className="bg-gradient-to-br from-primary to-[#7e14ff] py-24 text-white lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-white/70">
            Security &amp; Trust
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Your code deserves a safe review
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/80">
            Reviews happen on infrastructure built for the highest bars of privacy and compliance.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {trustPoints.map((t) => (
            <div
              key={t.title}
              className="rounded-2xl border border-white/15 bg-white/5 p-7 backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-white/15">
                <t.icon className="size-6 text-white" />
              </div>
              <h3 className="mb-2 text-base font-bold">{t.title}</h3>
              <p className="text-sm leading-relaxed text-white/80">{t.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {compliance.map((badge) => (
            <div key={badge} className="flex items-center gap-2 text-white/80">
              <CheckCircle2 className="size-4 shrink-0 text-white" />
              <span className="text-sm font-medium">{badge}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Final CTA ─────────────────────────────────────────────────────────────────
function CtaSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className={cn('py-24 lg:py-32', PAGE_ALT)}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className={cn('relative overflow-hidden rounded-3xl border px-8 py-16 text-center shadow-xl', BORDER, CARD)}>
          <div className="pointer-events-none absolute inset-0 select-none" aria-hidden>
            <div className="absolute -right-20 -top-20 size-[400px] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 size-[400px] rounded-full bg-violet-500/10 blur-3xl" />
          </div>

          <h2 className={cn('relative text-3xl font-extrabold tracking-tight sm:text-4xl', TEXT)}>
            Ready to ship cleaner code?
          </h2>
          <p className={cn('relative mx-auto mt-4 max-w-xl text-lg', TEXT_MUTED)}>
            Join thousands of developers who review smarter with LintWise. Free to start, no card
            required.
          </p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to={isAuthenticated ? ROUTES.DASHBOARD : ROUTES.REGISTER}>
                {isAuthenticated ? 'Open Dashboard' : 'Get started free'}
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={ROUTES.UPGRADE}>Compare plans</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className={cn('border-t', BORDER, PAGE_ALT)}>
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 pb-12 md:grid-cols-6">
          {/* Brand */}
          <div className="col-span-2">
            <Link to={ROUTES.HOME} className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Code2 className="size-5" />
              </span>
              <span className={cn('text-lg font-bold tracking-tight', TEXT)}>LintWise</span>
            </Link>
            <p className={cn('mt-4 max-w-[220px] text-sm leading-relaxed', TEXT_MUTED_SOFT)}>
              The AI code review tool that helps teams ship safer software, faster.
            </p>
          </div>

          {Object.entries(footerCols).map(([group, links]) => (
            <div key={group}>
              <h4 className={cn('mb-4 text-xs font-semibold uppercase tracking-wider', TEXT)}>
                {group}
              </h4>
              <ul className="space-y-3">
                {links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith('#') ? (
                      <a
                        href={l.href}
                        className={cn('text-sm transition-colors hover:text-primary', TEXT_MUTED_SOFT)}
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link
                        to={l.href}
                        className={cn('text-sm transition-colors hover:text-primary', TEXT_MUTED_SOFT)}
                      >
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={cn('flex flex-col items-center justify-between gap-4 border-t pt-7 sm:flex-row', BORDER)}>
          <p className={cn('text-xs', TEXT_MUTED_SOFT)}>
            © {new Date().getFullYear()} LintWise. All rights reserved.
          </p>
          <div className={cn('flex items-center gap-2 text-xs', TEXT_MUTED_SOFT)}>
            <span>Built for developers, with care.</span>
            <Code2 className="size-3.5 text-primary" />
          </div>
        </div>
      </div>
    </footer>
  )
}
