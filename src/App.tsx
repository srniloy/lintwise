import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import { useThemeStore } from '@/store/themeStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toast'
import { Spinner } from '@/components/ui/spinner'

// Layouts & guards
import PublicLayout from '@/layouts/PublicLayout'
import AppLayout from '@/layouts/AppLayout'
import ProtectedRoute from '@/components/ProtectedRoute'
import RoleGuard from '@/components/RoleGuard'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Lazy-loaded pages
const LoginPage           = lazy(() => import('@/pages/LoginPage'))
const RegisterPage        = lazy(() => import('@/pages/RegisterPage'))
const ForgotPasswordPage  = lazy(() => import('@/pages/ForgotPasswordPage'))
const ResetPasswordPage   = lazy(() => import('@/pages/ResetPasswordPage'))
const VerifyEmailPage     = lazy(() => import('@/pages/VerifyEmailPage'))
const DashboardPage       = lazy(() => import('@/pages/DashboardPage'))
const ReviewNewPage       = lazy(() => import('@/pages/ReviewNewPage'))
const ReviewsPage         = lazy(() => import('@/pages/ReviewsPage'))
const ReviewDetailPage    = lazy(() => import('@/pages/ReviewDetailPage'))
const ReviewStatusPage    = lazy(() => import('@/pages/ReviewStatusPage'))
const SnippetsPage        = lazy(() => import('@/pages/SnippetsPage'))
const CollectionsPage     = lazy(() => import('@/pages/CollectionsPage'))
const ProfilePage         = lazy(() => import('@/pages/ProfilePage'))
const UpgradePage         = lazy(() => import('@/pages/UpgradePage'))
const TeamPage            = lazy(() => import('@/pages/TeamPage'))
const TeamAcceptPage      = lazy(() => import('@/pages/TeamAcceptPage'))
const AdminPage           = lazy(() => import('@/pages/AdminPage'))
const HomePage            = lazy(() => import('@/pages/HomePage'))
const NotFoundPage        = lazy(() => import('@/pages/NotFoundPage'))

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

function ThemeInitializer() {
  const theme = useThemeStore((s) => s.theme)
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
  }, [theme])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeInitializer />
      <TooltipProvider delayDuration={300}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Root → public marketing homepage */}
              <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />

              {/* Public routes — redirect to dashboard if already authed */}
              <Route element={<PublicLayout />}>
                <Route path={ROUTES.LOGIN}            element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
                <Route path={ROUTES.REGISTER}         element={<ErrorBoundary><RegisterPage /></ErrorBoundary>} />
                <Route path={ROUTES.FORGOT_PASSWORD}  element={<ErrorBoundary><ForgotPasswordPage /></ErrorBoundary>} />
                <Route path={ROUTES.RESET_PASSWORD}   element={<ErrorBoundary><ResetPasswordPage /></ErrorBoundary>} />
                <Route path={ROUTES.VERIFY_EMAIL}     element={<ErrorBoundary><VerifyEmailPage /></ErrorBoundary>} />
              </Route>

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                {/* Standalone accept-invite page (no sidebar) */}
                <Route path={ROUTES.TEAM_ACCEPT} element={<ErrorBoundary><TeamAcceptPage /></ErrorBoundary>} />

                <Route element={<AppLayout />}>
                  <Route path={ROUTES.DASHBOARD}   element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
                  <Route path={ROUTES.REVIEW_NEW}  element={<ErrorBoundary><ReviewNewPage /></ErrorBoundary>} />
                  <Route path={ROUTES.REVIEWS}     element={<ErrorBoundary><ReviewsPage /></ErrorBoundary>} />
                  <Route path="/review/:id"        element={<ErrorBoundary><ReviewDetailPage /></ErrorBoundary>} />
                  <Route path="/review/:id/status" element={<ErrorBoundary><ReviewStatusPage /></ErrorBoundary>} />
                  <Route path={ROUTES.SNIPPETS}    element={<ErrorBoundary><SnippetsPage /></ErrorBoundary>} />
                  <Route path={ROUTES.COLLECTIONS} element={<ErrorBoundary><CollectionsPage /></ErrorBoundary>} />
                  <Route path={ROUTES.PROFILE}     element={<ErrorBoundary><ProfilePage /></ErrorBoundary>} />
                  <Route path={ROUTES.UPGRADE}    element={<ErrorBoundary><UpgradePage /></ErrorBoundary>} />

                  {/* Premium only */}
                  <Route element={<RoleGuard allowedRoles={['PREMIUM', 'ADMIN']} />}>
                    <Route path={ROUTES.TEAM} element={<ErrorBoundary><TeamPage /></ErrorBoundary>} />
                  </Route>

                  {/* Admin only */}
                  <Route element={<RoleGuard allowedRoles={['ADMIN']} />}>
                    <Route path={ROUTES.ADMIN} element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>

        <Toaster />
      </TooltipProvider>
    </BrowserRouter>
  )
}
