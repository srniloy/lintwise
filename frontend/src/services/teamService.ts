import { api } from './apiClient'
import type { Team } from '@/types'

export const teamService = {
  create: (name: string) =>
    api.post<Team>('/teams', { name }),

  getCurrent: () =>
    api.get<Team>('/teams/current'),

  invite: (teamId: string, email: string) =>
    api.post<{ message: string }>(`/teams/${teamId}/invite`, { email }),

  removeMember: (teamId: string, userId: string) =>
    api.delete<void>(`/teams/${teamId}/members/${userId}`),

  acceptInvite: (token: string) =>
    api.get<Team>(`/teams/invite/accept?token=${encodeURIComponent(token)}`),

  transferOwnership: (teamId: string, newOwnerId: string) =>
    api.put<Team>(`/teams/${teamId}/transfer-ownership`, { newOwnerId }),
}
