import express from 'express';

function getOptionalUserId(req) {
  return req.user?.id || req.user?.userId || null;
}

export function createMentorFeedbackRouter({ prisma }) {
  const router = express.Router();

  router.post('/mentor-feedback', async (req, res) => {
    try {
      const {
        labId,
        sessionId = null,
        userId = null,
        messageId,
        suggestionId,
        feedback,
        timestamp,
      } = req.body || {};

      if (!labId || !messageId || !suggestionId || !feedback || !timestamp) {
        return res.status(400).json({ error: 'labId, messageId, suggestionId, feedback, and timestamp are required' });
      }

      if (!['confirm', 'deny'].includes(feedback)) {
        return res.status(400).json({ error: 'feedback must be confirm or deny' });
      }

      const resolvedUserId = getOptionalUserId(req) || userId || null;
      const meta = {
        labId,
        sessionId,
        userId: resolvedUserId,
        messageId,
        suggestionId,
        feedback,
        timestamp,
        source: 'ai-mentor',
      };

      const record = await prisma.analytics.create({
        data: {
          event: 'mentor_feedback',
          userId: resolvedUserId,
          meta: JSON.stringify(meta),
        },
      });

      res.json({
        ok: true,
        id: record.id,
        savedAt: record.createdAt,
      });
    } catch (error) {
      console.error('POST /api/ai/mentor-feedback error:', error);
      res.status(500).json({ error: 'Failed to record mentor feedback' });
    }
  });

  return router;
}

export default createMentorFeedbackRouter;
