import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Reply, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { commentService } from '@/services/commentService'
import { teamService } from '@/services/teamService'
import { useAuth } from '@/hooks/useAuth'
import type { Comment, CreateCommentDto, TeamMember } from '@/types'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn, formatRelativeTime } from '@/lib/utils'

const POLL_MS = 30_000

// ── CommentsPanel ─────────────────────────────────────────────────────────────

interface Props {
  reviewId: string
  onCountChange?: (count: number) => void
}

export default function CommentsPanel({ reviewId, onCountChange }: Props) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    void loadComments(true)
    pollRef.current = setInterval(() => void loadComments(false), POLL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [reviewId])

  useEffect(() => {
    teamService.getCurrent()
      .then((t) => setMembers(t.members))
      .catch(() => {})
  }, [])

  async function loadComments(initial: boolean) {
    if (initial) setLoading(true)
    try {
      const data = await commentService.list(reviewId)
      setComments(data)
      const total = data.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0)
      onCountChange?.(total)
    } catch { /* silent */ }
    finally { if (initial) setLoading(false) }
  }

  function handleDelete(commentId: string) {
    commentService
      .delete(commentId)
      .then(() => {
        setComments((prev) => {
          const next = pruneComment(prev, commentId)
          const total = next.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0)
          onCountChange?.(total)
          return next
        })
      })
      .catch((err: unknown) =>
        toast.error((err as { message?: string })?.message ?? 'Delete failed'),
      )
  }

  function pruneComment(list: Comment[], id: string): Comment[] {
    return list
      .filter((c) => c.id !== id)
      .map((c) => ({ ...c, replies: c.replies ? pruneComment(c.replies, id) : c.replies }))
  }

  function handlePosted(comment: Comment) {
    setComments((prev) => {
      const next = comment.parentId
        ? prev.map((c) =>
            c.id === comment.parentId
              ? { ...c, replies: [...(c.replies ?? []), comment] }
              : c,
          )
        : [...prev, comment]
      const total = next.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0)
      onCountChange?.(total)
      return next
    })
    setReplyTo(null)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="md" />
      </div>
    )
  }

  const topLevel = comments.filter((c) => !c.parentId)

  return (
    <div className="space-y-4">
      {topLevel.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
          <MessageSquare size={28} className="opacity-30" />
          <p className="text-sm">No comments yet. Be the first to comment.</p>
        </div>
      )}

      {topLevel.map((c) => (
        <CommentThread
          key={c.id}
          comment={c}
          currentUserId={user?.id ?? ''}
          onReply={setReplyTo}
          onDelete={handleDelete}
        />
      ))}

      <CommentForm
        reviewId={reviewId}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onPosted={handlePosted}
        members={members}
      />
    </div>
  )
}

// ── CommentThread ─────────────────────────────────────────────────────────────

function CommentThread({
  comment,
  currentUserId,
  onReply,
  onDelete,
}: {
  comment: Comment
  currentUserId: string
  onReply: (c: Comment) => void
  onDelete: (id: string) => void
}) {
  return (
    <div>
      <CommentItem
        comment={comment}
        isOwn={comment.userId === currentUserId}
        showReply
        onReply={() => onReply(comment)}
        onDelete={onDelete}
      />
      {(comment.replies ?? []).map((reply) => (
        <div key={reply.id} className="ml-10 mt-2">
          <CommentItem
            comment={reply}
            isOwn={reply.userId === currentUserId}
            showReply={false}
            onReply={() => {}}
            onDelete={onDelete}
          />
        </div>
      ))}
    </div>
  )
}

// ── CommentItem ───────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  isOwn,
  showReply,
  onReply,
  onDelete,
}: {
  comment: Comment
  isOwn: boolean
  showReply: boolean
  onReply: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
        {comment.authorName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">
              {comment.authorName}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground/60">
              {formatRelativeTime(comment.createdAt)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {showReply && (
              <button
                onClick={onReply}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Reply size={11} />
                Reply
              </button>
            )}
            {isOwn && (
              <button
                onClick={() => onDelete(comment.id)}
                aria-label="Delete comment"
                className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {comment.content}
        </p>
      </div>
    </div>
  )
}

// ── CommentForm ───────────────────────────────────────────────────────────────

function CommentForm({
  reviewId,
  replyTo,
  onCancelReply,
  onPosted,
  members,
}: {
  reviewId: string
  replyTo: Comment | null
  onCancelReply: () => void
  onPosted: (c: Comment) => void
  members: TeamMember[]
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAnchor, setMentionAnchor] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const mentionSuggestions =
    mentionQuery !== null
      ? members
          .filter((m) => m.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
          .slice(0, 5)
      : []

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    setText(val)
    const pos = e.target.selectionStart ?? val.length
    const before = val.slice(0, pos)
    const match = /@(\w*)$/.exec(before)
    if (match) {
      setMentionQuery(match[1])
      setMentionAnchor(match.index)
    } else {
      setMentionQuery(null)
    }
  }

  function insertMention(member: TeamMember) {
    const before = text.slice(0, mentionAnchor)
    const after = text.slice(mentionAnchor).replace(/@\w*/, '')
    setText(`${before}@${member.name} ${after}`)
    setMentionQuery(null)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  async function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      const dto: CreateCommentDto = { content: trimmed }
      if (replyTo) dto.parentId = replyTo.id
      const comment = await commentService.create(reviewId, dto)
      onPosted(comment)
      setText('')
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? 'Failed to post comment')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2 pt-2">
      {replyTo && (
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <Reply size={11} />
          Replying to{' '}
          <strong className="text-foreground">{replyTo.authorName}</strong>
          <button
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="ml-auto hover:text-foreground"
          >
            ×
          </button>
        </div>
      )}

      <div className="relative">
        {mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-0 z-10 mb-1 w-52 overflow-hidden rounded-md border border-border bg-popover shadow-md">
            {mentionSuggestions.map((m) => (
              <button
                key={m.userId}
                onMouseDown={(e) => { e.preventDefault(); insertMention(m) }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                {m.name}
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !mentionSuggestions.length) {
              e.preventDefault()
              void handleSubmit()
            }
            if (e.key === 'Escape') setMentionQuery(null)
          }}
          placeholder={
            replyTo
              ? `Reply to ${replyTo.authorName}… type @ to mention`
              : 'Add a comment… type @ to mention someone'
          }
          rows={3}
          className={cn(
            'w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5',
            'text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring',
          )}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Shift+Enter for new line • Enter to post</p>
        <Button
          size="sm"
          onClick={() => void handleSubmit()}
          disabled={!text.trim()}
          loading={submitting}
        >
          <Send size={13} />
          {replyTo ? 'Reply' : 'Comment'}
        </Button>
      </div>
    </div>
  )
}
