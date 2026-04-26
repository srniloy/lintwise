import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('teams')
@ApiBearerAuth('access-token')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  /** POST /teams — create a new team (PREMIUM/ADMIN only) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('PREMIUM', 'ADMIN')
  @ApiOperation({ summary: 'Create a new team' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTeamDto) {
    return this.teamsService.create(user.sub, dto);
  }

  /** GET /teams/current — get the current user's team */
  @Get('current')
  @Roles('PREMIUM', 'ADMIN')
  @ApiOperation({ summary: "Get the current user's team with members" })
  getCurrent(@CurrentUser() user: JwtPayload) {
    return this.teamsService.getCurrentTeam(user.sub);
  }

  /** GET /teams/invite/accept?token= — accept a team invite (requires auth) */
  @Get('invite/accept')
  @Roles('PREMIUM', 'ADMIN')
  @ApiOperation({ summary: 'Accept a team invite via token (authenticated user)' })
  acceptInvite(@Query('token') token: string, @CurrentUser() user: JwtPayload) {
    return this.teamsService.acceptInvite(token, user.sub);
  }

  /** POST /teams/:id/invite — invite a member by email */
  @Post(':id/invite')
  @HttpCode(HttpStatus.CREATED)
  @Roles('PREMIUM', 'ADMIN')
  @ApiOperation({ summary: 'Invite a user to the team by email' })
  invite(
    @CurrentUser() user: JwtPayload,
    @Param('id') teamId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.teamsService.inviteMember(teamId, user.sub, dto);
  }

  /** DELETE /teams/:id/members/:userId — remove a member */
  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('PREMIUM', 'ADMIN')
  @ApiOperation({ summary: 'Remove a member from the team' })
  removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamsService.removeMember(teamId, user.sub, memberId);
  }

  /** PUT /teams/:id/members/:userId/role — update a member's role */
  @Put(':id/members/:memberId/role')
  @Roles('PREMIUM', 'ADMIN')
  @ApiOperation({ summary: "Update a member's role" })
  updateMemberRole(
    @CurrentUser() user: JwtPayload,
    @Param('id') teamId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.teamsService.updateMemberRole(teamId, user.sub, memberId, dto);
  }

  /** PUT /teams/:id/transfer-ownership — transfer team ownership */
  @Put(':id/transfer-ownership')
  @Roles('PREMIUM', 'ADMIN')
  @ApiOperation({ summary: 'Transfer team ownership to another member' })
  transferOwnership(
    @CurrentUser() user: JwtPayload,
    @Param('id') teamId: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    return this.teamsService.transferOwnership(teamId, user.sub, dto);
  }
}
