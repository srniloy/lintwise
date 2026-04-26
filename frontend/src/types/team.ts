export type TeamMemberRole = 'OWNER' | 'MEMBER'

export interface TeamMember {
  id: string
  userId: string
  name: string
  email: string
  role: TeamMemberRole
  joinedAt: string
}

export interface Team {
  id: string
  name: string
  ownerId: string
  memberCount: number
  members: TeamMember[]
  createdAt: string
}

export interface Comment {
  id: string
  reviewId: string
  userId: string
  authorName: string
  authorAvatarUrl?: string
  content: string
  parentId?: string | null
  replies?: Comment[]
  createdAt: string
  updatedAt: string
}

export interface CreateCommentDto {
  content: string
  parentId?: string
}
