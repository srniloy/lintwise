import { api } from './apiClient'
import type { PaginatedResponse, UserRole } from '@/types'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: UserRole
  isSuspended: boolean
  createdAt: string
  lastLoginAt?: string | null
  reviewCount?: number
}

export interface AdminUsersQuery {
  search?: string
  role?: UserRole | 'ALL'
  page?: number
  limit?: number
}

export type ServiceStatus = 'UP' | 'DOWN' | 'DEGRADED'

export interface ServiceHealth {
  name: string
  status: ServiceStatus
  latencyMs?: number
  message?: string
}

export interface SystemHealth {
  database: ServiceHealth
  redis: ServiceHealth
  gemini: ServiceHealth
  uptimeSeconds: number
  checkedAt: string
}

export interface PlatformStats {
  totalUsers: number
  activeUsersToday: number
  activeUsers7d: number
  totalReviews: number
  reviewsToday: number
  reviews7d: number
  reviewsByStatus: {
    PENDING: number
    PROCESSING: number
    COMPLETED: number
    FAILED: number
  }
  dailyReviews: { date: string; count: number }[]
}

export interface RateLimitTier {
  tier: 'USER' | 'PREMIUM' | 'ADMIN'
  limit: number
  windowSeconds: number
  used: number
  utilization: number
}

export interface RateLimitTopUser {
  userId: string
  name: string
  email: string
  role: UserRole
  used: number
  limit: number
  utilization: number
}

export interface RateLimitMonitor {
  tiers: RateLimitTier[]
  topUsers: RateLimitTopUser[]
}

export const adminService = {
  listUsers: (query: AdminUsersQuery = {}) => {
    const params = new URLSearchParams()
    if (query.search) params.set('search', query.search)
    if (query.role && query.role !== 'ALL') params.set('role', query.role)
    if (query.page) params.set('page', String(query.page))
    if (query.limit) params.set('limit', String(query.limit))
    const qs = params.toString()
    return api.get<PaginatedResponse<AdminUser>>(`/admin/users${qs ? `?${qs}` : ''}`)
  },

  updateUserRole: (userId: string, role: UserRole) =>
    api.put<AdminUser>(`/admin/users/${userId}/role`, { role }),

  suspendUser: (userId: string) =>
    api.post<AdminUser>(`/admin/users/${userId}/suspend`),

  unsuspendUser: (userId: string) =>
    api.post<AdminUser>(`/admin/users/${userId}/unsuspend`),

  deleteUser: (userId: string) =>
    api.delete<void>(`/admin/users/${userId}`),

  getSystemHealth: () =>
    api.get<SystemHealth>('/admin/system/health'),

  getPlatformStats: () =>
    api.get<PlatformStats>('/admin/stats'),

  getRateLimitMonitor: () =>
    api.get<RateLimitMonitor>('/admin/rate-limits'),
}
