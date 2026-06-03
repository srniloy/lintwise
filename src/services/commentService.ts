import { api } from './apiClient'
import type { Comment, CreateCommentDto } from '@/types'

export const commentService = {
  list: (reviewId: string) =>
    api.get<Comment[]>(`/reviews/${reviewId}/comments`),

  create: (reviewId: string, dto: CreateCommentDto) =>
    api.post<Comment>(`/reviews/${reviewId}/comments`, dto),

  update: (commentId: string, content: string) =>
    api.put<Comment>(`/comments/${commentId}`, { content }),

  delete: (commentId: string) =>
    api.delete<void>(`/comments/${commentId}`),
}
