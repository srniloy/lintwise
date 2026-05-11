export type UserRole = 'USER' | 'PREMIUM' | 'ADMIN'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatarUrl?: string
  subscriptionEndDate?: string | null
  cancelAtPeriodEnd?: boolean
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterCredentials {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  user: User
  accessToken: string
  refreshToken: string
}
