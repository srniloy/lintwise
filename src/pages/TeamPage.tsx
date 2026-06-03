import { useEffect, useState } from 'react'
import { Users, UserPlus, Crown, Trash2, ArrowRightLeft } from 'lucide-react'
import { toast } from 'sonner'
import { teamService } from '@/services/teamService'
import { useAuth } from '@/hooks/useAuth'
import type { Team, TeamMember } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
} from '@/components/ui/modal'

export default function TeamPage() {
  const { user } = useAuth()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [teamName, setTeamName] = useState('')
  const [creating, setCreating] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null)
  const [removing, setRemoving] = useState(false)
  const [transferTarget, setTransferTarget] = useState<TeamMember | null>(null)
  const [transferring, setTransferring] = useState(false)

  useEffect(() => { void loadTeam() }, [])

  const isOwner = team?.ownerId === user?.id

  async function loadTeam() {
    setLoading(true)
    try {
      const t = await teamService.getCurrent()
      setTeam(t)
    } catch (err: unknown) {
      if ((err as { statusCode?: number })?.statusCode !== 404) {
        toast.error('Failed to load team')
      }
      setTeam(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!teamName.trim()) return
    setCreating(true)
    try {
      const t = await teamService.create(teamName.trim())
      setTeam(t)
      setTeamName('')
      toast.success('Team created')
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? 'Failed to create team')
    } finally {
      setCreating(false)
    }
  }

  async function handleInvite() {
    if (!team || !inviteEmail.trim()) return
    setInviting(true)
    try {
      await teamService.invite(team.id, inviteEmail.trim())
      setInviteEmail('')
      toast.success('Invitation sent — they have 24 hours to accept')
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? 'Failed to send invite')
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove() {
    if (!team || !removeTarget) return
    setRemoving(true)
    try {
      await teamService.removeMember(team.id, removeTarget.userId)
      setTeam({
        ...team,
        members: team.members.filter((m) => m.userId !== removeTarget.userId),
        memberCount: team.memberCount - 1,
      })
      toast.success(`${removeTarget.name} removed from team`)
      setRemoveTarget(null)
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? 'Failed to remove member')
    } finally {
      setRemoving(false)
    }
  }

  async function handleTransfer() {
    if (!team || !transferTarget) return
    setTransferring(true)
    try {
      const updated = await teamService.transferOwnership(team.id, transferTarget.userId)
      setTeam(updated)
      toast.success(`Ownership transferred to ${transferTarget.name}`)
      setTransferTarget(null)
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? 'Failed to transfer ownership')
    } finally {
      setTransferring(false)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  // ── No team — create form ──────────────────────────────────────────────────

  if (!team) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Users size={18} className="text-primary" />
              </div>
              <div>
                <CardTitle>Create Your Team</CardTitle>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Collaborate on code reviews with your colleagues
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
            />
            <Button
              className="w-full"
              onClick={() => void handleCreate()}
              loading={creating}
              disabled={!teamName.trim()}
            >
              Create Team
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ── Team view ──────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-480 space-y-6 p-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          <span>{team.memberCount} member{team.memberCount !== 1 ? 's' : ''}</span>
          {isOwner && (
            <span className="inline-flex items-center gap-1 text-yellow-500">
              <Crown size={12} />
              You are the owner
            </span>
          )}
        </p>
      </div>

      {/* Members list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul role="list" className="divide-y divide-border">
            {team.members.map((member) => (
              <li key={member.userId} className="flex items-center gap-4 px-6 py-3.5">
                {/* Avatar initial */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                  {member.name.charAt(0).toUpperCase()}
                </div>

                {/* Name + email */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground">{member.name}</p>
                    {member.role === 'OWNER' && (
                      <Crown size={12} className="text-yellow-500" />
                    )}
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 text-[10px] uppercase tracking-wide"
                    >
                      {member.role.toLowerCase()}
                    </Badge>
                    {member.userId === user?.id && (
                      <span className="text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                </div>

                {/* Joined date */}
                <p className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {new Date(member.joinedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>

                {/* Owner actions — non-owner, non-self members only */}
                {isOwner && member.userId !== user?.id && member.role !== 'OWNER' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setTransferTarget(member)}
                      title="Transfer ownership"
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <ArrowRightLeft size={13} />
                    </button>
                    <button
                      onClick={() => setRemoveTarget(member)}
                      title="Remove member"
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Invite card — owner only */}
      {isOwner && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <UserPlus size={15} className="text-muted-foreground" />
              <CardTitle className="text-base">Invite Member</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleInvite()}
                className="flex-1"
              />
              <Button
                onClick={() => void handleInvite()}
                loading={inviting}
                disabled={!inviteEmail.trim()}
              >
                Send Invite
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Invite link expires after 24 hours. Teams support up to 50 members.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Remove member modal */}
      <Modal open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Remove Member</ModalTitle>
            <ModalDescription>
              Remove{' '}
              <strong className="font-semibold text-foreground">{removeTarget?.name}</strong> from{' '}
              <strong className="font-semibold text-foreground">{team.name}</strong>? They will
              lose access to all shared team reviews.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline">Cancel</Button>
            </ModalClose>
            <Button variant="danger" onClick={() => void handleRemove()} loading={removing}>
              Remove
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Transfer ownership modal */}
      <Modal open={!!transferTarget} onOpenChange={(o) => !o && setTransferTarget(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Transfer Ownership</ModalTitle>
            <ModalDescription>
              Transfer ownership of{' '}
              <strong className="font-semibold text-foreground">{team.name}</strong> to{' '}
              <strong className="font-semibold text-foreground">{transferTarget?.name}</strong>?
              You will become a regular member and lose owner privileges.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline">Cancel</Button>
            </ModalClose>
            <Button variant="danger" onClick={() => void handleTransfer()} loading={transferring}>
              Transfer Ownership
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </div>
  )
}
