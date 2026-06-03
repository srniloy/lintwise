export type CollectionItemType = 'REVIEW' | 'SNIPPET'

export interface SnippetVersion {
  id: string
  snippetId: string
  code: string
  version: number
  createdAt: string
}

export interface Snippet {
  id: string
  userId: string
  title: string
  language: string
  code: string
  version: number
  createdAt: string
  updatedAt: string
}

export interface CreateSnippetDto {
  title: string
  language: string
  code: string
}

export interface UpdateSnippetDto {
  title?: string
  language?: string
  code?: string
}

export interface CollectionItem {
  id: string
  collectionId: string
  type: CollectionItemType
  referenceId: string
  title: string
  createdAt: string
}

export interface Collection {
  id: string
  userId: string
  name: string
  description?: string
  shareToken?: string
  itemCount: number
  createdAt: string
  updatedAt: string
  items?: CollectionItem[]
}

export interface CreateCollectionDto {
  name: string
  description?: string
}

export interface UpdateCollectionDto {
  name?: string
  description?: string
}

export interface AddCollectionItemDto {
  type: CollectionItemType
  referenceId: string
  title?: string
}
