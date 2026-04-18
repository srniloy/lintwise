import { api } from './apiClient'
import type { Review, ReviewStatus, CreateReviewDto } from '@/types/review'

export interface ReviewStatusResponse {
  id: string
  status: ReviewStatus
  createdAt: string
}

export const reviewService = {
  create: (dto: CreateReviewDto) =>
    api.post<Review>('/reviews', dto),

  getById: (id: string) =>
    api.get<Review>(`/reviews/${id}`),

  getStatus: (id: string) =>
    api.get<ReviewStatusResponse>(`/reviews/${id}/status`),

  deleteById: (id: string) =>
    api.delete<void>(`/reviews/${id}`),

  list: (params?: { page?: number; limit?: number; status?: string; language?: string; search?: string }) => {
    const query = new URLSearchParams()
    if (params?.page)     query.set('page',     String(params.page))
    if (params?.limit)    query.set('limit',    String(params.limit))
    if (params?.status)   query.set('status',   params.status)
    if (params?.language) query.set('language', params.language)
    if (params?.search)   query.set('search',   params.search)
    const qs = query.toString()
    return api.get<{ data: Review[]; total: number; page: number; totalPages: number }>(
      `/reviews${qs ? `?${qs}` : ''}`,
    )
  },
}
