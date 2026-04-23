import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, AnalyticsRange } from './dto/analytics-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /analytics/personal?range=7d|30d|90d
   * Returns aggregate stats for the current user's own reviews.
   */
  @Get('personal')
  @ApiOperation({ summary: 'Personal code review analytics for the current user' })
  getPersonal(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    const range = query.range ?? AnalyticsRange.MONTH;
    return this.analyticsService.getPersonalStats(user.sub, range);
  }

  /**
   * GET /analytics/team?range=7d|30d|90d
   * Returns team-wide aggregate stats. PREMIUM and ADMIN only.
   */
  @Get('team')
  @Roles('PREMIUM', 'ADMIN')
  @ApiOperation({ summary: 'Team-wide analytics (PREMIUM + ADMIN only)' })
  getTeam(@CurrentUser() user: JwtPayload, @Query() query: AnalyticsQueryDto) {
    const range = query.range ?? AnalyticsRange.MONTH;
    return this.analyticsService.getTeamStats(user.sub, range);
  }
}
