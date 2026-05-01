import * as crypto from 'crypto';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Webhook, WebhookDelivery, WebhookEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateWebhookDto } from './dto/create-webhook.dto';
import type { UpdateWebhookDto } from './dto/update-webhook.dto';

// ── Constants ────────────────────────────────────────────────────────────────

/** Total attempts (initial + retries). The spec asks for "retry 3x". */
export const MAX_DELIVERY_ATTEMPTS = 3;

/** Backoff schedule (ms) between retries. */
const RETRY_DELAY_MS = [1_000, 5_000, 15_000];

const DELIVERY_TIMEOUT_MS = 10_000;

const HMAC_HEADER = 'X-LintWise-Signature';
const EVENT_HEADER = 'X-LintWise-Event';
const DELIVERY_HEADER = 'X-LintWise-Delivery';

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(userId: string, dto: CreateWebhookDto): Promise<Webhook> {
    const secret = this.generateSecret();

    return this.prisma.webhook.create({
      data: {
        userId,
        url: dto.url,
        events: dto.events,
        secret,
        isActive: true,
      },
    });
  }

  async findAll(userId: string): Promise<Webhook[]> {
    return this.prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateWebhookDto,
  ): Promise<Webhook> {
    await this.assertOwned(id, userId);

    const data: Prisma.WebhookUpdateInput = {};
    if (dto.url !== undefined) data.url = dto.url;
    if (dto.events !== undefined) data.events = { set: dto.events };
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.webhook.update({ where: { id }, data });
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.assertOwned(id, userId);
    await this.prisma.webhook.delete({ where: { id } });
  }

  // ── Dispatch (called by other services) ──────────────────────────────────

  /**
   * Find every active webhook for `userId` subscribed to `event`,
   * and deliver `payload` to each. Failures on individual hooks are logged
   * but do not interrupt the others.
   */
  async dispatch(
    userId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const hooks = await this.prisma.webhook.findMany({
      where: { userId, isActive: true, events: { has: event } },
    });

    if (hooks.length === 0) return;

    await Promise.allSettled(
      hooks.map((h) =>
        this.deliver(h.id, event, payload).catch((err: unknown) => {
          this.logger.warn(
            `Webhook ${h.id} delivery raised: ${(err as Error)?.message ?? String(err)}`,
          );
        }),
      ),
    );
  }

  // ── Deliver (with retry) ─────────────────────────────────────────────────

  /**
   * Deliver `payload` to webhook `webhookId` with HMAC-SHA256 signing.
   * Retries up to MAX_DELIVERY_ATTEMPTS on network failure or non-2xx response.
   * Persists a single WebhookDelivery row recording the final outcome.
   */
  async deliver(
    webhookId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>,
  ): Promise<WebhookDelivery> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!webhook) throw new NotFoundException('Webhook not found');

    const body = JSON.stringify(payload);
    const signature = this.sign(body, webhook.secret);

    let lastStatus: number | undefined;
    let attempts = 0;
    let delivered = false;

    for (let i = 0; i < MAX_DELIVERY_ATTEMPTS; i++) {
      attempts = i + 1;
      try {
        lastStatus = await this.postSigned(webhook.url, body, signature, event, webhookId);
        if (lastStatus >= 200 && lastStatus < 300) {
          delivered = true;
          break;
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Webhook ${webhookId} attempt ${attempts} failed: ${(err as Error)?.message ?? String(err)}`,
        );
        lastStatus = undefined;
      }

      if (i < MAX_DELIVERY_ATTEMPTS - 1) {
        await this.sleep(RETRY_DELAY_MS[i] ?? 15_000);
      }
    }

    return this.prisma.webhookDelivery.create({
      data: {
        webhookId,
        event,
        payload: payload as Prisma.InputJsonValue,
        statusCode: lastStatus ?? null,
        attempts,
        deliveredAt: delivered ? new Date() : null,
      },
    });
  }

  // ── Manual retry of a stored delivery ────────────────────────────────────

  async retry(
    webhookId: string,
    deliveryId: string,
    userId: string,
  ): Promise<WebhookDelivery> {
    await this.assertOwned(webhookId, userId);

    const original = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
    });
    if (!original || original.webhookId !== webhookId) {
      throw new NotFoundException('Delivery not found');
    }

    return this.deliver(webhookId, original.event, original.payload as Record<string, unknown>);
  }

  // ── List deliveries for a webhook ────────────────────────────────────────

  async listDeliveries(
    webhookId: string,
    userId: string,
  ): Promise<WebhookDelivery[]> {
    await this.assertOwned(webhookId, userId);
    return this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private async assertOwned(webhookId: string, userId: string): Promise<Webhook> {
    const hook = await this.prisma.webhook.findUnique({ where: { id: webhookId } });
    if (!hook) throw new NotFoundException('Webhook not found');
    if (hook.userId !== userId) throw new ForbiddenException('Access denied');
    return hook;
  }

  private generateSecret(): string {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
  }

  /** Returns the full header value: `sha256=<hex>`. */
  sign(body: string, secret: string): string {
    const digest = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return `sha256=${digest}`;
  }

  /**
   * Single HTTP POST attempt. Throws on network errors or timeout; resolves
   * with the response status (including non-2xx) otherwise.
   */
  private async postSigned(
    url: string,
    body: string,
    signature: string,
    event: WebhookEvent,
    webhookId: string,
  ): Promise<number> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [HMAC_HEADER]: signature,
          [EVENT_HEADER]: event,
          [DELIVERY_HEADER]: webhookId,
          'User-Agent': 'LintWise-Webhook/1.0',
        },
        body,
        signal: controller.signal,
      });
      return res.status;
    } finally {
      clearTimeout(timer);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
