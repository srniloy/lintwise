import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Headers,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import StripeConstructor from 'stripe';

import { SubscriptionService } from './subscription.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { ConfirmCheckoutDto } from './dto/confirm-checkout.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { JwtPayload } from '../common/decorators/current-user.decorator';

const STRIPE_API_VERSION = '2026-04-22.dahlia' as const;

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly config: ConfigService,
  ) {}

  // ── Create Checkout Session ─────────────────────────────────────────────

  @Post('create-checkout-session')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a Stripe Checkout Session for Premium upgrade' })
  async createCheckoutSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.subscriptionService.createCheckoutSession(
      user.sub,
      user.email,
      dto.priceId,
      dto.successUrl,
      dto.cancelUrl,
    );
  }

  @Post('confirm-checkout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Confirm a completed checkout session and upgrade the user' })
  async confirmCheckout(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmCheckoutDto,
  ) {
    return this.subscriptionService.confirmCheckoutSession(user.sub, dto.sessionId);
  }

  // ── Stripe Webhook ──────────────────────────────────────────────────────

  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    const secretKey = this.config.get<string>('stripe.secretKey');
    const webhookSecret = this.config.get<string>('stripe.webhookSecret');

    if (!secretKey || !webhookSecret) {
      this.logger.warn('Stripe not configured — skipping webhook');
      return { received: true };
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      this.logger.error('Missing rawBody — ensure NestFactory is created with { rawBody: true }');
      return { received: true };
    }

    const stripe = new StripeConstructor(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    }) as any;

    let event: any;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      this.logger.error(`Webhook signature verification failed: ${(err as Error).message}`);
      return { received: true };
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.subscriptionService.handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.subscriptionService.handleSubscriptionDeleted(event.data.object);
        break;
      default:
        this.logger.debug(`Unhandled webhook event type: ${event.type}`);
    }

    return { received: true };
  }

  // ── List Invoices ───────────────────────────────────────────────────────

  @Get('invoices')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List subscription invoices for the current user' })
  listInvoices(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.listInvoices(user.sub);
  }

  // ── Download Invoice PDF ────────────────────────────────────────────────

  @Get('invoices/:id/pdf')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Download invoice PDF' })
  async downloadInvoice(
    @CurrentUser() user: JwtPayload,
    @Param('id') invoiceId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename, contentType } =
      await this.subscriptionService.downloadInvoice(user.sub, invoiceId);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  // ── Cancel Subscription ─────────────────────────────────────────────────

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel the active premium subscription' })
  cancelSubscription(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.cancelSubscription(user.sub);
  }

  @Post('resubscribe')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Reactivate a subscription that was set to cancel' })
  resubscribe(@CurrentUser() user: JwtPayload) {
    return this.subscriptionService.resubscribe(user.sub);
  }
}
