export type * from './auth'
export type * from './review'
export type * from './snippet'
export type * from './notification'
export type * from './team'

export interface ApiError {
  message: string
  statusCode: number
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
