import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/constants/routes'

export default function PublicLayout() {
  const { isAuthenticated } = useAuth()

  // Already logged in → send to dashboard
  if (isAuthenticated) {
    return <Navigate to={ROUTES.DASHBOARD} replace />
  }

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  )
}
