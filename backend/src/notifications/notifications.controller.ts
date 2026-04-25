import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { NotificationPreferencesDto } from './dto/notification-preferences.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   * Returns the current user's notifications with unread count (max 50, newest first).
   */
  @Get()
  @ApiOperation({ summary: 'Get in-app notifications for the current user' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.findAll(user.sub);
  }

  /**
   * GET /notifications/preferences
   * Returns the user's notification email preferences.
   * Must be declared BEFORE /:id to prevent route shadowing.
   */
  @Get('preferences')
  @ApiOperation({ summary: 'Get notification email preferences' })
  getPreferences(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getPreferences(user.sub);
  }

  /**
   * PUT /notifications/preferences
   * Updates one or more notification email preferences.
   */
  @Put('preferences')
  @ApiOperation({ summary: 'Update notification email preferences' })
  updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: NotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.sub, dto);
  }

  /**
   * PATCH /notifications/read-all
   * Marks every unread notification as read for the current user.
   * Must be declared BEFORE /:id/read to prevent route shadowing.
   */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  /**
   * PATCH /notifications/:id/read
   * Marks a single notification as read. Returns 403 if not the owner.
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 403, description: 'Notification belongs to a different user' })
  markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notificationsService.markAsRead(id, user.sub);
  }

  /**
   * GET /notifications/unsubscribe?token=
   * @Public — no auth required.
   * Disables all email notifications for the user encoded in the HMAC token.
   * Links to this endpoint are embedded in notification emails.
   */
  @Get('unsubscribe')
  @Public()
  @ApiOperation({ summary: 'Unsubscribe from all email notifications via token link' })
  @ApiResponse({ status: 400, description: 'Invalid unsubscribe token' })
  unsubscribe(@Query('token') token: string) {
    return this.notificationsService.unsubscribeByToken(token);
  }
}
