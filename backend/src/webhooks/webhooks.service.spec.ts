import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { WebhooksService, MAX_DELIVERY_ATTEMPTS } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  webhook: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  webhookDelivery: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

function makeWebhook(overrides: Partial<any> = {}): any {
  return {
    id: 'hook-1',
    userId: 'user-1',
    url: 'https://example.com/hook',
    events: ['REVIEW_COMPLETED'],
    secret: 'whsec_testsecret',
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe('WebhooksService', () => {
  let service: WebhooksService;
  let fetchMock: jest.SpyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);

    // Bypass real network and remove the retry backoff delays so tests stay fast
    fetchMock = jest.spyOn(globalThis, 'fetch' as any);
    jest.spyOn<any, any>(service as any, 'sleep').mockResolvedValue(undefined);
  });

  afterEach(() => {
    fetchMock?.mockRestore();
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('generates a long random HMAC secret prefixed with whsec_', async () => {
      mockPrisma.webhook.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'hook-1', ...data }),
      );

      const result = await service.create('user-1', {
        url: 'https://example.com/hook',
        events: ['REVIEW_COMPLETED'] as any,
      });

      expect(result.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
      expect(mockPrisma.webhook.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          url: 'https://example.com/hook',
          events: ['REVIEW_COMPLETED'],
          isActive: true,
        }),
      });
    });

    it('generates a fresh secret for each new webhook', async () => {
      mockPrisma.webhook.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'hook-x', ...data }),
      );

      const a = await service.create('user-1', { url: 'https://a.test', events: ['REVIEW_COMPLETED'] as any });
      const b = await service.create('user-1', { url: 'https://b.test', events: ['REVIEW_COMPLETED'] as any });

      expect(a.secret).not.toEqual(b.secret);
    });
  });

  // ── update / delete authorization ─────────────────────────────────────────

  describe('update() / delete()', () => {
    it('throws ForbiddenException when updating someone else\'s webhook', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook({ userId: 'other-user' }));

      await expect(
        service.update('hook-1', 'user-1', { isActive: false }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.webhook.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when deleting an unknown webhook', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('updates the events list when provided', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook());
      mockPrisma.webhook.update.mockResolvedValue(makeWebhook({ events: ['REVIEW_FAILED'] }));

      await service.update('hook-1', 'user-1', { events: ['REVIEW_FAILED'] as any });

      expect(mockPrisma.webhook.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'hook-1' },
          data: expect.objectContaining({ events: { set: ['REVIEW_FAILED'] } }),
        }),
      );
    });
  });

  // ── deliver() — HMAC signing ──────────────────────────────────────────────

  describe('deliver()', () => {
    it('signs the request body with HMAC-SHA256 using the webhook secret', async () => {
      const hook = makeWebhook({ secret: 'whsec_known-secret' });
      mockPrisma.webhook.findUnique.mockResolvedValue(hook);
      mockPrisma.webhookDelivery.create.mockResolvedValue({ id: 'd1' });

      fetchMock.mockResolvedValueOnce({ status: 200 } as any);

      const payload = { event: 'REVIEW_COMPLETED', reviewId: 'r1' };
      await service.deliver('hook-1', 'REVIEW_COMPLETED' as any, payload);

      const body = JSON.stringify(payload);
      const expected =
        'sha256=' +
        crypto.createHmac('sha256', hook.secret).update(body).digest('hex');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(calledUrl).toBe(hook.url);
      expect(init.method).toBe('POST');
      expect(init.body).toBe(body);
      const headers = init.headers as Record<string, string>;
      expect(headers['X-LintWise-Signature']).toBe(expected);
      expect(headers['X-LintWise-Event']).toBe('REVIEW_COMPLETED');
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('records the delivery with status 200 and a deliveredAt timestamp on success', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook());
      mockPrisma.webhookDelivery.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'd1', ...data }),
      );

      fetchMock.mockResolvedValueOnce({ status: 200 } as any);

      const result = await service.deliver(
        'hook-1',
        'REVIEW_COMPLETED' as any,
        { reviewId: 'r1' },
      );

      expect(result.statusCode).toBe(200);
      expect(result.attempts).toBe(1);
      expect(result.deliveredAt).toBeInstanceOf(Date);
    });

    it('retries up to MAX_DELIVERY_ATTEMPTS on 5xx responses', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook());
      mockPrisma.webhookDelivery.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'd1', ...data }),
      );

      fetchMock
        .mockResolvedValueOnce({ status: 500 } as any)
        .mockResolvedValueOnce({ status: 502 } as any)
        .mockResolvedValueOnce({ status: 503 } as any);

      const result = await service.deliver(
        'hook-1',
        'REVIEW_COMPLETED' as any,
        { reviewId: 'r1' },
      );

      expect(fetchMock).toHaveBeenCalledTimes(MAX_DELIVERY_ATTEMPTS);
      expect(result.attempts).toBe(MAX_DELIVERY_ATTEMPTS);
      expect(result.statusCode).toBe(503);
      expect(result.deliveredAt).toBeNull();
    });

    it('retries on network errors and stops once the response is 2xx', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook());
      mockPrisma.webhookDelivery.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'd1', ...data }),
      );

      fetchMock
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({ status: 204 } as any);

      const result = await service.deliver(
        'hook-1',
        'REVIEW_COMPLETED' as any,
        { reviewId: 'r1' },
      );

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.attempts).toBe(2);
      expect(result.statusCode).toBe(204);
      expect(result.deliveredAt).toBeInstanceOf(Date);
    });

    it('persists a WebhookDelivery row even when every attempt fails', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook());
      mockPrisma.webhookDelivery.create.mockImplementation(({ data }: { data: any }) =>
        Promise.resolve({ id: 'd1', ...data }),
      );

      fetchMock
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'));

      const result = await service.deliver(
        'hook-1',
        'REVIEW_COMPLETED' as any,
        { reviewId: 'r1' },
      );

      expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            webhookId: 'hook-1',
            event: 'REVIEW_COMPLETED',
            attempts: MAX_DELIVERY_ATTEMPTS,
            statusCode: null,
            deliveredAt: null,
          }),
        }),
      );
      expect(result.deliveredAt).toBeNull();
    });
  });

  // ── dispatch() ────────────────────────────────────────────────────────────

  describe('dispatch()', () => {
    it('delivers to every active webhook for the user/event', async () => {
      const hooks = [
        makeWebhook({ id: 'h1' }),
        makeWebhook({ id: 'h2', url: 'https://example.com/other' }),
      ];
      mockPrisma.webhook.findMany.mockResolvedValue(hooks);

      const deliverSpy = jest
        .spyOn(service, 'deliver')
        .mockResolvedValue({} as any);

      await service.dispatch('user-1', 'REVIEW_COMPLETED' as any, { reviewId: 'r1' });

      expect(mockPrisma.webhook.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', isActive: true, events: { has: 'REVIEW_COMPLETED' } },
      });
      expect(deliverSpy).toHaveBeenCalledTimes(2);
    });

    it('does nothing when the user has no matching active webhooks', async () => {
      mockPrisma.webhook.findMany.mockResolvedValue([]);
      const deliverSpy = jest.spyOn(service, 'deliver');

      await service.dispatch('user-1', 'REVIEW_COMPLETED' as any, { reviewId: 'r1' });

      expect(deliverSpy).not.toHaveBeenCalled();
    });

    it('isolates failures: one hook erroring does not block the others', async () => {
      mockPrisma.webhook.findMany.mockResolvedValue([
        makeWebhook({ id: 'h1' }),
        makeWebhook({ id: 'h2' }),
      ]);

      const deliverSpy = jest
        .spyOn(service, 'deliver')
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error('hook 2 broke'));

      await expect(
        service.dispatch('user-1', 'REVIEW_COMPLETED' as any, { reviewId: 'r1' }),
      ).resolves.toBeUndefined();

      expect(deliverSpy).toHaveBeenCalledTimes(2);
    });
  });

  // ── retry() ───────────────────────────────────────────────────────────────

  describe('retry()', () => {
    it('replays the original payload through deliver()', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook());
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue({
        id: 'd1',
        webhookId: 'hook-1',
        event: 'REVIEW_COMPLETED',
        payload: { reviewId: 'r1' },
        statusCode: 500,
        attempts: 3,
        deliveredAt: null,
        createdAt: new Date(),
      });

      const deliverSpy = jest
        .spyOn(service, 'deliver')
        .mockResolvedValue({ id: 'd2' } as any);

      await service.retry('hook-1', 'd1', 'user-1');

      expect(deliverSpy).toHaveBeenCalledWith('hook-1', 'REVIEW_COMPLETED', { reviewId: 'r1' });
    });

    it('rejects retrying a delivery that belongs to a different webhook', async () => {
      mockPrisma.webhook.findUnique.mockResolvedValue(makeWebhook());
      mockPrisma.webhookDelivery.findUnique.mockResolvedValue({
        id: 'd1',
        webhookId: 'someone-else',
        event: 'REVIEW_COMPLETED',
        payload: {},
      });

      await expect(service.retry('hook-1', 'd1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
