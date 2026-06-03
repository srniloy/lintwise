import { api } from './apiClient'
import type { Snippet, SnippetVersion, CreateSnippetDto, UpdateSnippetDto } from '@/types/snippet'

export const snippetService = {
  list: (params?: { page?: number; limit?: number; search?: string; language?: string }) => {
    const query = new URLSearchParams()
    if (params?.page)     query.set('page',     String(params.page))
    if (params?.limit)    query.set('limit',    String(params.limit))
    if (params?.search)   query.set('search',   params.search)
    if (params?.language) query.set('language', params.language)
    const qs = query.toString()
    return api.get<{ snippets: Snippet[]; total: number; page: number; limit: number }>(
      `/snippets${qs ? `?${qs}` : ''}`,
    )
  },

  getById: (id: string) =>
    api.get<Snippet>(`/snippets/${id}`),

  getVersions: (id: string) =>
    api.get<SnippetVersion[]>(`/snippets/${id}/versions`),

  create: (dto: CreateSnippetDto) =>
    api.post<Snippet>('/snippets', dto),

  update: (id: string, dto: UpdateSnippetDto) =>
    api.put<Snippet>(`/snippets/${id}`, dto),

  deleteById: (id: string) =>
    api.delete<void>(`/snippets/${id}`),
}
