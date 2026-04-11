import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const logout = useAuthStore((s) => s.logout)
  const setUser = useAuthStore((s) => s.setUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const isAdmin = user?.role === 'ADMIN'
  const isPremium = user?.role === 'PREMIUM' || user?.role === 'ADMIN'

  return {
    user,
    isAuthenticated,
    isAdmin,
    isPremium,
    login,
    register,
    logout,
    setUser,
    clearAuth,
  }
}
