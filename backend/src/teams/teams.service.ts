import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { TeamRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { CreateTeamDto } from './dto/create-team.dto';
import type { InviteMemberDto } from './dto/invite-member.dto';
import type { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto';

const MAX_MEMBERS = 50;

// ── Shape returned by Prisma for a team with members ─────────────────────────

type MemberWithUser = {
  id: string;
  userId: string;
  role: TeamRole;
  joinedAt: Date;
  user: { name: string; email: string };
};

type TeamWithMembers = {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  members: MemberWithUser[];
};

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private readonly memberInclude = {
    user: { select: { name: true, email: true } },
  } satisfies Prisma.TeamMemberInclude;

  private mapTeam(team: TeamWithMembers) {
    return {
      id: team.id,
      name: team.name,
      ownerId: team.ownerId,
      memberCount: team.members.length,
      members: team.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role as string,
        joinedAt: m.joinedAt.toISOString(),
      })),
      createdAt: team.createdAt.toISOString(),
    };
  }

  private async fetchTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        members: {
          include: this.memberInclude,
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  // ── create ────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateTeamDto) {
    const existing = await this.prisma.teamMember.findFirst({ where: { userId } });
    if (existing) throw new ConflictException('You already belong to a team');

    const team = await this.prisma.team.create({
      data: {
        name: dto.name,
        ownerId: userId,
        members: { create: { userId, role: 'OWNER' } },
      },
      include: {
        members: {
          include: this.memberInclude,
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    return this.mapTeam(team);
  }

  // ── getCurrentTeam ────────────────────────────────────────────────────────

  async getCurrentTeam(userId: string) {
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId },
      select: { teamId: true },
    });
    if (!membership) throw new NotFoundException('You do not belong to a team');
    return this.mapTeam(await this.fetchTeam(membership.teamId));
  }

  // ── inviteMember ──────────────────────────────────────────────────────────

  async inviteMember(teamId: string, ownerId: string, dto: InviteMemberDto) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerId !== ownerId)
      throw new ForbiddenException('Only the team owner can invite members');
    if (team.members.length >= MAX_MEMBERS)
      throw new BadRequestException(`Team already has the maximum of ${MAX_MEMBERS} members`);

    // Check if the email already belongs to a team member; also fetch owner name for notification
    const [invitedUser, owner] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } }),
      this.prisma.user.findUnique({ where: { id: ownerId }, select: { name: true } }),
    ]);
    if (invitedUser) {
      const isMember = team.members.some((m) => m.userId === invitedUser.id);
      if (isMember) throw new ConflictException('This user is already a team member');
    }

    // Replace any stale invite for the same email
    await this.prisma.teamInvite.deleteMany({ where: { teamId, email: dto.email } });

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.teamInvite.create({
      data: { teamId, email: dto.email, token, expiresAt },
    });

    void this.mail.sendTeamInviteEmail(dto.email, team.name, token).catch(() => {});

    // Notify the invited user if they already have a LintWise account
    if (invitedUser) {
      void this.notifications
        .create(
          invitedUser.id,
          'TEAM_INVITE',
          'Team invitation',
          `${owner?.name ?? 'Someone'} invited you to join ${team.name}`,
          { resourceId: teamId, resourceType: 'team' },
        )
        .catch(() => {});
    }

    return { message: 'Invitation sent' };
  }

  // ── acceptInvite ──────────────────────────────────────────────────────────

  async acceptInvite(token: string, userId: string) {
    const invite = await this.prisma.teamInvite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invalid invite token');
    if (invite.expiresAt < new Date()) {
      await this.prisma.teamInvite.delete({ where: { token } });
      throw new BadRequestException('Invite token has expired');
    }

    const alreadyMember = await this.prisma.teamMember.findFirst({ where: { userId } });
    if (alreadyMember) throw new ConflictException('You already belong to a team');

    const memberCount = await this.prisma.teamMember.count({
      where: { teamId: invite.teamId },
    });
    if (memberCount >= MAX_MEMBERS)
      throw new BadRequestException('Team is at capacity');

    await this.prisma.$transaction([
      this.prisma.teamMember.create({
        data: { teamId: invite.teamId, userId, role: 'MEMBER' },
      }),
      this.prisma.teamInvite.delete({ where: { token } }),
    ]);

    // Notify team owner (fire-and-forget)
    const [team, newMember] = await Promise.all([
      this.prisma.team.findUnique({ where: { id: invite.teamId }, select: { ownerId: true } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    if (team) {
      void this.notifications
        .create(
          team.ownerId,
          'TEAM_INVITE',
          'New team member',
          `${newMember?.name ?? 'Someone'} accepted your team invite`,
          { resourceId: invite.teamId, resourceType: 'team' },
        )
        .catch(() => {});
    }

    return { message: 'You have joined the team' };
  }

  // ── removeMember ──────────────────────────────────────────────────────────

  async removeMember(teamId: string, ownerId: string, memberId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { ownerId: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerId !== ownerId)
      throw new ForbiddenException('Only the team owner can remove members');
    if (memberId === ownerId)
      throw new BadRequestException('Cannot remove the team owner');

    const membership = await this.prisma.teamMember.findFirst({
      where: { teamId, userId: memberId },
    });
    if (!membership) throw new NotFoundException('Member not found in this team');

    await this.prisma.teamMember.delete({ where: { id: membership.id } });
  }

  // ── updateMemberRole ──────────────────────────────────────────────────────

  async updateMemberRole(
    teamId: string,
    ownerId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { ownerId: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerId !== ownerId)
      throw new ForbiddenException('Only the team owner can update roles');
    if (dto.role === 'OWNER')
      throw new BadRequestException('Use transfer-ownership to change the owner');

    const membership = await this.prisma.teamMember.findFirst({
      where: { teamId, userId: memberId },
    });
    if (!membership) throw new NotFoundException('Member not found in this team');

    await this.prisma.teamMember.update({
      where: { id: membership.id },
      data: { role: dto.role },
    });
    return this.mapTeam(await this.fetchTeam(teamId));
  }

  // ── transferOwnership ─────────────────────────────────────────────────────

  async transferOwnership(teamId: string, currentOwnerId: string, dto: TransferOwnershipDto) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { ownerId: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.ownerId !== currentOwnerId)
      throw new ForbiddenException('Only the team owner can transfer ownership');

    const [newOwnerMembership, currentOwnerMembership] = await Promise.all([
      this.prisma.teamMember.findFirst({ where: { teamId, userId: dto.newOwnerId } }),
      this.prisma.teamMember.findFirst({ where: { teamId, userId: currentOwnerId } }),
    ]);
    if (!newOwnerMembership)
      throw new NotFoundException('New owner must be an existing team member');

    await this.prisma.$transaction([
      this.prisma.team.update({
        where: { id: teamId },
        data: { ownerId: dto.newOwnerId },
      }),
      this.prisma.teamMember.update({
        where: { id: newOwnerMembership.id },
        data: { role: 'OWNER' },
      }),
      ...(currentOwnerMembership
        ? [
            this.prisma.teamMember.update({
              where: { id: currentOwnerMembership.id },
              data: { role: 'MEMBER' },
            }),
          ]
        : []),
    ]);

    return this.mapTeam(await this.fetchTeam(teamId));
  }
}
