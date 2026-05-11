import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

type StripeClient = InstanceType<typeof Stripe>;

export interface InvoiceDto {
  id: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  date: string;
  description: string;
}

export interface CheckoutSessionDto {
  url: string;
  sessionId: string;
}

const STRIPE_API_VERSION = '2026-04-22.dahlia' as const;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly stripe: StripeClient | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    const secretKey = this.config.get<string>('stripe.secretKey');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not set — Stripe features will fail');
    } else {
      this.stripe = new Stripe(secretKey, {
        apiVersion: STRIPE_API_VERSION,
      }) as unknown as StripeClient;
    }
  }

  private get stripeClient(): StripeClient {
    if (!this.stripe) {
      throw new InternalServerErrorException('Stripe is not configured');
    }
    return this.stripe;
  }

  private get frontendUrl(): string {
    return this.config.get<string>('frontendUrl', 'http://localhost:5173');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async getOrCreateCustomer(userId: string, email: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (user.stripeCustomerId) {
      const customer = await this.stripeClient.customers.retrieve(
        user.stripeCustomerId,
      );
      if (!customer.deleted) return user.stripeCustomerId;

      this.logger.warn(
        `Stripe customer ${user.stripeCustomerId} was deleted. Creating a new one.`,
      );
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: null },
      });
    }

    const customer = await this.stripeClient.customers.create({
      email,
      metadata: { userId },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  // ── Confirm Checkout Session ────────────────────────────────────────────

  async confirmCheckoutSession(
    userId: string,
    sessionId: string,
  ): Promise<{ role: string; accessToken: string; refreshToken: string }> {
    const session = await this.stripeClient.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.userId !== userId) {
      throw new BadRequestException('Session does not belong to this user');
    }

    if (session.status !== 'complete' && session.payment_status !== 'paid') {
      throw new BadRequestException('Checkout session is not completed');
    }

    const customerId = session.customer as string;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'PREMIUM',
        stripeCustomerId: customerId,
        cancelAtPeriodEnd: false,
        subscriptionEndDate: null,
      },
    });

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const tokens = await this.authService.generateTokens({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    this.logger.log(`User ${userId} upgraded to PREMIUM (confirm-checkout, session: ${sessionId})`);

    return { role: 'PREMIUM', ...tokens };
  }

  // ── Create Checkout Session ─────────────────────────────────────────────

  async createCheckoutSession(
    userId: string,
    userEmail: string,
    priceId?: string,
    successUrl?: string,
    cancelUrl?: string,
  ): Promise<CheckoutSessionDto> {
    const customerId = await this.getOrCreateCustomer(userId, userEmail);
    const resolvedPriceId =
      priceId ?? this.config.get<string>('stripe.priceId');

    if (!resolvedPriceId) {
      throw new InternalServerErrorException(
        'Premium price ID is not configured (STRIPE_PREMIUM_PRICE_ID)',
      );
    }

    const subscriptions = await this.stripeClient.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      throw new BadRequestException('You already have an active premium subscription');
    }

    const session = await this.stripeClient.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      metadata: { userId },
      success_url: successUrl ?? `${this.frontendUrl}/upgrade?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${this.frontendUrl}/upgrade?cancelled=1`,
    });

    if (!session.url) {
      throw new InternalServerErrorException('Failed to create checkout session');
    }

    return { url: session.url, sessionId: session.id };
  }

  // ── Webhook handlers ───────────────────────────────────────────────────

  async handleCheckoutCompleted(session: any): Promise<void> {
    const userId = session.metadata?.userId as string | undefined;
    if (!userId) {
      this.logger.warn('Checkout session missing userId metadata', { sessionId: session.id });
      return;
    }

    const customerId = session.customer as string;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        role: 'PREMIUM',
        stripeCustomerId: customerId,
        cancelAtPeriodEnd: false,
        subscriptionEndDate: null,
      },
    });

    this.logger.log(`User ${userId} upgraded to PREMIUM (session: ${session.id})`);
  }

  async handleSubscriptionDeleted(subscription: any): Promise<void> {
    const customerId = subscription.customer as string;
    const user = await this.prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (!user) {
      this.logger.warn('Subscription deleted for unknown customer', { customerId });
      return;
    }

    if (user.role === 'PREMIUM') {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'USER',
          cancelAtPeriodEnd: false,
          subscriptionEndDate: null,
        },
      });
      this.logger.log(`User ${user.id} downgraded to USER (subscription deleted)`);
    }
  }

  // ── Resubscribe ──────────────────────────────────────────────────────────

  async resubscribe(
    userId: string,
  ): Promise<{
    message: string;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      avatarUrl: string | null;
      cancelAtPeriodEnd: boolean;
      subscriptionEndDate: string | null;
    };
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.stripeCustomerId) {
      throw new BadRequestException('No subscription found');
    }

    const subscriptions = await this.stripeClient.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new BadRequestException('No active subscription found');
    }

    const subscription = subscriptions.data[0];

    if (!subscription.cancel_at_period_end) {
      throw new BadRequestException('Subscription is not scheduled for cancellation');
    }

    await this.stripeClient.subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        cancelAtPeriodEnd: false,
        subscriptionEndDate: null,
      },
    });

    const updatedUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    this.logger.log(`Subscription ${subscription.id} resubscribed for user ${userId}`);

    return {
      message: 'Your subscription has been reactivated.',
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        avatarUrl: updatedUser.avatarUrl,
        cancelAtPeriodEnd: updatedUser.cancelAtPeriodEnd,
        subscriptionEndDate: updatedUser.subscriptionEndDate?.toISOString() ?? null,
      },
    };
  }

  // ── List Invoices ───────────────────────────────────────────────────────

  async listInvoices(userId: string): Promise<InvoiceDto[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.stripeCustomerId) return [];

    const invoices = await this.stripeClient.invoices.list({
      customer: user.stripeCustomerId,
      limit: 50,
    });

    return invoices.data.map((inv: any) => ({
      id: inv.id,
      amount: inv.total / 100,
      currency: inv.currency,
      status: inv.status === 'paid' ? 'paid' as const : inv.status === 'open' ? 'pending' as const : 'failed' as const,
      date: new Date(inv.created * 1000).toISOString(),
      description: inv.lines.data[0]?.description ?? `Invoice ${inv.number ?? inv.id}`,
    }));
  }

  // ── Download Invoice PDF ────────────────────────────────────────────────

  async downloadInvoice(userId: string, invoiceId: string): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const invoice = await this.stripeClient.invoices.retrieve(invoiceId);
    if (invoice.customer !== user.stripeCustomerId) {
      throw new NotFoundException('Invoice not found');
    }

    if (!invoice.invoice_pdf) {
      throw new NotFoundException('Invoice PDF not available');
    }

    const response = await fetch(invoice.invoice_pdf);
    const buffer = Buffer.from(await response.arrayBuffer());

    return {
      buffer,
      filename: `invoice-${invoice.number ?? invoiceId}.pdf`,
      contentType: 'application/pdf',
    };
  }

  // ── Cancel Subscription ────────────────────────────────────────────────

  async cancelSubscription(
    userId: string,
  ): Promise<{
    message: string;
    subscriptionEndDate: string | null;
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      avatarUrl: string | null;
      cancelAtPeriodEnd: boolean;
      subscriptionEndDate: string | null;
    };
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!user.stripeCustomerId) {
      throw new BadRequestException('No subscription found');
    }

    const subscriptions = await this.stripeClient.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new BadRequestException('No active subscription found');
    }

    const sub = subscriptions.data[0] as any;

    if (sub.cancel_at_period_end) {
      // Stripe v2026-04-22.dahlia removed current_period_end; use cancel_at or billing_cycle_anchor
      const existingPeriodEnd = sub.cancel_at ?? sub.billing_cycle_anchor;
      const existingEnd = existingPeriodEnd
        ? new Date(existingPeriodEnd * 1000)
        : null;

      this.logger.log(`Already cancelled — cancel_at: ${sub.cancel_at}, date: ${existingEnd}`);

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          cancelAtPeriodEnd: true,
          subscriptionEndDate: existingEnd,
        },
      });

      const syncedUser = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });

      this.logger.log(`Subscription ${sub.id} was already set to cancel for user ${userId} — synced DB`);

      return {
        message:
          'Your premium features will remain active until the end of the current billing period, after which your account will revert to the Free plan.',
        subscriptionEndDate: existingEnd?.toISOString() ?? null,
        user: {
          id: syncedUser.id,
          name: syncedUser.name,
          email: syncedUser.email,
          role: syncedUser.role,
          avatarUrl: syncedUser.avatarUrl,
          cancelAtPeriodEnd: syncedUser.cancelAtPeriodEnd,
          subscriptionEndDate: syncedUser.subscriptionEndDate?.toISOString() ?? null,
        },
      };
    }

    const updatedSub = await this.stripeClient.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    }) as any;

    // Stripe v2026-04-22.dahlia removed current_period_end from Subscription.
    // cancel_at is populated when cancel_at_period_end is set to true.
    const periodEnd = updatedSub.cancel_at ?? sub.cancel_at ?? sub.billing_cycle_anchor;
    this.logger.log(`Cancel — cancel_at: ${updatedSub.cancel_at}, fallback billing_cycle_anchor: ${sub.billing_cycle_anchor}`);

    const subscriptionEndDate = periodEnd ? new Date(periodEnd * 1000) : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        cancelAtPeriodEnd: true,
        subscriptionEndDate,
      },
    });

    const updatedUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    this.logger.log(`Subscription ${sub.id} will cancel at period end for user ${userId}`);

    return {
      message:
        'Your premium features will remain active until the end of the current billing period, after which your account will revert to the Free plan.',
      subscriptionEndDate: subscriptionEndDate?.toISOString() ?? null,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        avatarUrl: updatedUser.avatarUrl,
        cancelAtPeriodEnd: updatedUser.cancelAtPeriodEnd,
        subscriptionEndDate: updatedUser.subscriptionEndDate?.toISOString() ?? null,
      },
    };
  }
}
