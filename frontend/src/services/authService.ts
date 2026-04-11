import { api } from './apiClient'
import type {
  AuthResponse,
  LoginCredentials,
  RegisterCredentials,
  User,
} from '@/types'

export const authService = {
  login: (credentials: LoginCredentials) =>
    api.post<AuthResponse>('/auth/login', credentials),

  register: (credentials: RegisterCredentials) =>
    api.post<AuthResponse>('/auth/register', credentials),

  logout: () => api.post<void>('/auth/logout'),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }),

  getProfile: () => api.get<User>('/users/profile'),

  updateProfile: (data: Partial<Pick<User, 'name' | 'avatarUrl'>>) =>
    api.put<User>('/users/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put<{ message: string }>('/users/change-password', {
      currentPassword,
      newPassword,
    }),

  refreshToken: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh', { refreshToken }),
}
