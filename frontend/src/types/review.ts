export type ReviewStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
export type IssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type IssueCategory =
  | 'SECURITY'
  | 'PERFORMANCE'
  | 'QUALITY'
  | 'STYLE'
  | 'DOCUMENTATION'
  | 'TESTING'
  | 'DEPENDENCIES'

export interface Issue {
  id: string
  reviewId: string
  category: IssueCategory
  severity: IssueSeverity
  title: string
  description: string
  suggestion?: string
  lineStart?: number
  lineEnd?: number
  fileName?: string
  createdAt: string
}

export interface Review {
  id: string
  userId: string
  title?: string
  language: string
  code: string
  status: ReviewStatus
  overallScore?: number
  summary?: string
  createdAt: string
  updatedAt: string
  issues?: Issue[]
}

export interface CreateReviewDto {
  title?: string
  language: string
  code: string
}
