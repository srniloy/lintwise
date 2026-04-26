import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
const TeamPage            = lazy(() => import('@/pages/TeamPage'))
const TeamAcceptPage      = lazy(() => import('@/pages/TeamAcceptPage'))
const AdminPage           = lazy(() => import('@/pages/AdminPage'))
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
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Root → redirect based on auth is handled in PublicLayout / ProtectedRoute */}
            <Route path="/" element={<Navigate to={ROUTES.DASHBOARD} replace />} />

            {/* Public routes — redirect to dashboard if already authed */}
            <Route element={<PublicLayout />}>
              <Route path={ROUTES.LOGIN}            element={<LoginPage />} />
              <Route path={ROUTES.REGISTER}         element={<RegisterPage />} />
              <Route path={ROUTES.FORGOT_PASSWORD}  element={<ForgotPasswordPage />} />
              <Route path={ROUTES.RESET_PASSWORD}   element={<ResetPasswordPage />} />
              <Route path={ROUTES.VERIFY_EMAIL}     element={<VerifyEmailPage />} />
            </Route>

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              {/* Standalone accept-invite page (no sidebar) */}
              <Route path={ROUTES.TEAM_ACCEPT} element={<TeamAcceptPage />} />

              <Route element={<AppLayout />}>
                <Route path={ROUTES.DASHBOARD}   element={<DashboardPage />} />
                <Route path={ROUTES.REVIEW_NEW}  element={<ReviewNewPage />} />
                <Route path={ROUTES.REVIEWS}     element={<ReviewsPage />} />
                <Route path="/review/:id"        element={<ReviewDetailPage />} />
                <Route path="/review/:id/status" element={<ReviewStatusPage />} />
                <Route path={ROUTES.SNIPPETS}    element={<SnippetsPage />} />
                <Route path={ROUTES.COLLECTIONS} element={<CollectionsPage />} />
                <Route path={ROUTES.PROFILE}     element={<ProfilePage />} />

                {/* Premium only */}
                <Route element={<RoleGuard allowedRoles={['PREMIUM', 'ADMIN']} />}>
                  <Route path={ROUTES.TEAM} element={<TeamPage />} />
                </Route>

                {/* Admin only */}
                <Route element={<RoleGuard allowedRoles={['ADMIN']} />}>
                  <Route path={ROUTES.ADMIN} element={<AdminPage />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>

        <Toaster />
      </TooltipProvider>
    </BrowserRouter>
  )
}
