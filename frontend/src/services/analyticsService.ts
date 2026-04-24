import { api } from './apiClient'
import type { IssueCategory, IssueSeverity } from '@/types/review'

export type AnalyticsRange = '7d' | '30d' | '90d'

export interface ScoreTrendPoint {
  date: string
  score: number
}

export interface LanguageCount {
  language: string
  count: number
}

export interface TopContributor {
  userId: string
  name: string
  reviewCount: number
}

export interface PersonalStats {
  range: AnalyticsRange
  totalReviews: number
  thisMonthReviews: number
  completedReviews: number
  averageScore: number | null
  issuesByCategory: Record<IssueCategory, number>
  issuesBySeverity: Record<IssueSeverity, number>
  scoreTrend: ScoreTrendPoint[]
  languages: LanguageCount[]
}

export interface TeamStats {
  range: AnalyticsRange
  teamId: string | null
  memberCount: number
  totalReviews: number
  completedReviews: number
  averageScore: number | null
  issuesByCategory: Record<IssueCategory, number>
  issuesBySeverity: Record<IssueSeverity, number>
  topContributors: TopContributor[]
}

export const analyticsService = {
  getPersonal: (range: AnalyticsRange) =>
    api.get<PersonalStats>(`/analytics/personal?range=${range}`),

  getTeam: (range: AnalyticsRange) =>
    api.get<TeamStats>(`/analytics/team?range=${range}`),
}
