export const MENTOR_FEEDBACK_VALUES = new Set(['confirm', 'deny']);

export function createMentorMessage({
  role,
  text,
  cached = false,
  messageId = globalThis.crypto?.randomUUID?.() ?? `mentor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  suggestionId = null,
}) {
  return {
    role,
    text,
    cached,
    messageId,
    suggestionId: suggestionId || messageId,
    feedbackState: 'idle',
    feedbackSavedValue: null,
    feedbackError: '',
  };
}

export function buildMentorFeedbackPayload({
  labId,
  sessionId = null,
  userId = null,
  message,
  feedback,
  timestamp = new Date().toISOString(),
}) {
  if (!message?.messageId) {
    throw new Error('messageId is required');
  }
  if (!MENTOR_FEEDBACK_VALUES.has(feedback)) {
    throw new Error('feedback must be confirm or deny');
  }

  return {
    labId,
    sessionId,
    userId,
    messageId: message.messageId,
    suggestionId: message.suggestionId || message.messageId,
    feedback,
    timestamp,
  };
}

export async function submitMentorFeedback(fetchImpl, payload) {
  const response = await fetchImpl('/api/ai/mentor-feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Feedback request failed with ${response.status}`);
  }

  return data;
}
