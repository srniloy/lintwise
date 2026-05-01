import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminService } from './admin.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin')
@ApiBearerAuth('access-token')
@Controller('admin')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (paginated, search + role filter)' })
  listUsers(@Query() dto: ListUsersDto) {
    return this.admin.getAllUsers(dto);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: "Update a user's role (USER / PREMIUM / ADMIN)" })
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.admin.updateUserRole(id, dto.role);
  }

  @Put('users/:id/suspend')
  @ApiOperation({ summary: 'Suspend a user account indefinitely' })
  suspend(@Param('id') id: string) {
    return this.admin.suspendUser(id);
  }

  @Put('users/:id/unsuspend')
  @ApiOperation({ summary: 'Reinstate a suspended user account' })
  unsuspend(@Param('id') id: string) {
    return this.admin.unsuspendUser(id);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a user (cascade)' })
  remove(@Param('id') id: string) {
    return this.admin.deleteUser(id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform-wide stats: users, reviews today, active users (7d)' })
  stats() {
    return this.admin.getPlatformStats();
  }

  @Get('system/health')
  @ApiOperation({ summary: 'Live status of DB, Redis, and Gemini API (FR8.1)' })
  systemHealth() {
    return this.admin.getSystemHealth();
  }

  @Get('rate-limits')
  @ApiOperation({ summary: 'Configured rate-limit tiers and current usage' })
  rateLimits() {
    return this.admin.getRateLimitMonitor();
  }
}
