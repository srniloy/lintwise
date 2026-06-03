import { api } from './apiClient'
import type {
  Collection,
  CollectionItem,
  CreateCollectionDto,
  UpdateCollectionDto,
  AddCollectionItemDto,
} from '@/types/snippet'

export const collectionService = {
  list: () =>
    api.get<Collection[]>('/collections'),

  getById: (id: string) =>
    api.get<Collection>(`/collections/${id}`),

  create: (dto: CreateCollectionDto) =>
    api.post<Collection>('/collections', dto),

  update: (id: string, dto: UpdateCollectionDto) =>
    api.put<Collection>(`/collections/${id}`, dto),

  deleteById: (id: string) =>
    api.delete<void>(`/collections/${id}`),

  addItem: (collectionId: string, dto: AddCollectionItemDto) =>
    api.post<CollectionItem>(`/collections/${collectionId}/items`, dto),

  removeItem: (collectionId: string, itemId: string) =>
    api.delete<void>(`/collections/${collectionId}/items/${itemId}`),

  share: (id: string) =>
    api.post<{ shareToken: string; shareUrl: string }>(`/collections/${id}/share`),
}
