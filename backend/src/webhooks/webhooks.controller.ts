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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

@ApiTags('webhooks')
@ApiBearerAuth('access-token')
@Controller('webhooks')
@Roles('PREMIUM', 'ADMIN')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new webhook (PREMIUM/ADMIN only)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWebhookDto) {
    return this.webhooks.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the current user\'s webhooks' })
  findAll(@CurrentUser() user: JwtPayload) {
    return this.webhooks.findAll(user.sub);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a webhook' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooks.update(id, user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a webhook' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.webhooks.delete(id, user.sub);
  }

  @Get(':id/deliveries')
  @ApiOperation({ summary: 'List recent deliveries for a webhook' })
  deliveries(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.webhooks.listDeliveries(id, user.sub);
  }

  @Post(':id/deliveries/:deliveryId/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed delivery' })
  retry(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('deliveryId') deliveryId: string,
  ) {
    return this.webhooks.retry(id, deliveryId, user.sub);
  }
}
