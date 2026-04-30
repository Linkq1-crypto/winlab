import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  processedWebhookEvent: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  event: {
    create: vi.fn(),
  },
};

vi.mock('../src/api/db/prisma.js', () => ({
  default: mockPrisma,
}));

const {
  createEventIfAbsent,
  isEventProcessed,
  markEventProcessed,
  processWebhookEvent,
} = await import('../src/services/webhookIdempotency.js');

describe('webhook idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats duplicate processed webhook markers as idempotent upserts', async () => {
    mockPrisma.processedWebhookEvent.upsert.mockResolvedValue({ eventId: 'evt_dup' });

    const result = await markEventProcessed('evt_dup', 'checkout.session.completed', { source: 'stripe' });

    expect(result).toEqual({ eventId: 'evt_dup' });
    expect(mockPrisma.processedWebhookEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'evt_dup' },
        create: expect.objectContaining({ eventId: 'evt_dup', eventType: 'checkout.session.completed' }),
        update: expect.objectContaining({ eventType: 'checkout.session.completed' }),
      })
    );
  });

  it('treats duplicate event IDs as idempotent success for Event rows', async () => {
    mockPrisma.event.create.mockRejectedValue({ code: 'P2002' });

    const result = await createEventIfAbsent({
      id: 'evt_dup',
      type: 'checkout.session.completed',
      payload: '{}',
      status: 'pending',
      version: 1,
    });

    expect(result).toMatchObject({ created: false, duplicate: true });
  });

  it('skips duplicate webhook processing before handler execution', async () => {
    mockPrisma.processedWebhookEvent.findUnique.mockResolvedValue({ eventId: 'evt_dup' });
    const handler = vi.fn();

    const result = await processWebhookEvent('evt_dup', 'checkout.session.completed', handler, { source: 'stripe' });

    expect(await isEventProcessed('evt_dup')).toBe(true);
    expect(result).toMatchObject({ processed: false, reason: 'already_processed' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('processes new webhooks and marks them after successful handling', async () => {
    mockPrisma.processedWebhookEvent.findUnique.mockResolvedValue(null);
    mockPrisma.processedWebhookEvent.upsert.mockResolvedValue({ eventId: 'evt_new' });
    const order = [];

    const result = await processWebhookEvent(
      'evt_new',
      'checkout.session.completed',
      async () => {
        order.push('handler');
        return { ok: true };
      },
      { source: 'stripe' }
    );

    order.push('after');

    expect(result).toMatchObject({ processed: true, result: { ok: true } });
    expect(mockPrisma.processedWebhookEvent.upsert).toHaveBeenCalledTimes(1);
    expect(order[0]).toBe('handler');
  });
});
