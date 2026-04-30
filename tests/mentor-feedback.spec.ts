import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { buildMentorFeedbackPayload, createMentorMessage } from '../src/services/mentorFeedback.js';
import { createMentorFeedbackRouter } from '../src/api/routes/mentorFeedback.js';

describe('mentor feedback payload', () => {
  it('builds the expected payload for mentor feedback', () => {
    const message = createMentorMessage({
      role: 'ai',
      text: 'Check the nginx service first.',
      messageId: 'msg-1',
      suggestionId: 'sugg-1',
    });

    const payload = buildMentorFeedbackPayload({
      labId: 'nginx-port-conflict',
      sessionId: 'session-1',
      userId: 'user-1',
      message,
      feedback: 'confirm',
      timestamp: '2026-04-30T10:00:00.000Z',
    });

    expect(payload).toEqual({
      labId: 'nginx-port-conflict',
      sessionId: 'session-1',
      userId: 'user-1',
      messageId: 'msg-1',
      suggestionId: 'sugg-1',
      feedback: 'confirm',
      timestamp: '2026-04-30T10:00:00.000Z',
    });
  });
});

describe('mentor feedback api route', () => {
  it('stores mentor feedback in analytics', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'analytics-1',
      createdAt: '2026-04-30T10:00:00.000Z',
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 'user-from-auth' };
      next();
    });
    app.use('/api/ai', createMentorFeedbackRouter({ prisma: { analytics: { create } } }));

    const response = await request(app)
      .post('/api/ai/mentor-feedback')
      .send({
        labId: 'nginx-port-conflict',
        sessionId: 'session-1',
        userId: 'user-from-body',
        messageId: 'msg-1',
        suggestionId: 'sugg-1',
        feedback: 'deny',
        timestamp: '2026-04-30T10:00:00.000Z',
      });

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: 'mentor_feedback',
        userId: 'user-from-auth',
      }),
    });

    const meta = JSON.parse(create.mock.calls[0][0].data.meta);
    expect(meta).toMatchObject({
      labId: 'nginx-port-conflict',
      sessionId: 'session-1',
      userId: 'user-from-auth',
      messageId: 'msg-1',
      suggestionId: 'sugg-1',
      feedback: 'deny',
    });
  });

  it('rejects invalid feedback payloads', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/ai', createMentorFeedbackRouter({ prisma: { analytics: { create: vi.fn() } } }));

    const response = await request(app)
      .post('/api/ai/mentor-feedback')
      .send({
        labId: 'nginx-port-conflict',
        messageId: 'msg-1',
        suggestionId: 'sugg-1',
        feedback: 'maybe',
        timestamp: '2026-04-30T10:00:00.000Z',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/feedback must be confirm or deny/i);
  });
});
