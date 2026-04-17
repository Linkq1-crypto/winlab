/**
 * Email Pipeline — Full processing flow from raw email to response
 * Extracts name → classifies → calculates trust → generates reply → sends
 */

import { extractName, buildGreeting, getSignature } from './nameExtractor.js';
import { classifyEmail } from './classifier.js';
import { calculateTrust, recommendAction, generateVerificationCode, generateVerifyToken } from './trustScore.js';
import { sendHelpdeskReply } from './sender.js';
import Anthropic from '@anthropic-ai/sdk';
import { getTeamTone } from './config.js';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

/**
 * Process an incoming email through the full pipeline
 * @param {object} email - { from, subject, body, snippet }
 * @returns {Promise<object>} Full processing result
 */
export async function processIncomingEmail({ from, subject, body, snippet }) {
  const emailBody = body || snippet || '';

  // Step 1: Extract sender name
  const senderName = extractName(from);

  // Step 2: Classify (team, intent, language, urgency, confidence)
  const classification = await classifyEmail({
    subject,
    body: emailBody,
    fromName: senderName,
  });

  // Step 3: Calculate trust score
  const trust = calculateTrust({
    from,
    contentLength: emailBody.length,
  });

  // Step 4: Determine action
  const action = recommendAction(trust.level, classification);

  // Step 5: Generate greeting
  const greeting = buildGreeting(senderName, classification.language);

  // Step 6: Generate AI reply suggestion
  const aiReply = await generateAIReply({
    greeting,
    subject,
    body: emailBody,
    team: classification.team,
    tone: getTeamTone(classification.team),
    language: classification.language,
  });

  return {
    senderName,
    classification,
    trust,
    action,
    greeting,
    suggestedReply: aiReply,
    signature: getSignature(classification.team),
  };
}

/**
 * Generate AI reply suggestion
 */
async function generateAIReply(params) {
  const { greeting, subject, body, team, tone, language } = params;

  if (!anthropic) {
    // Fallback template
    return `${greeting}\n\nThank you for reaching out to Winlab ${team}. We've received your message and our team is reviewing it. We'll respond shortly.\n\n—\nWinlab ${team.charAt(0).toUpperCase() + team.slice(1)} Team`;
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      system: `You are Winlab ${team} support agent.

Tone: ${tone}
Language: ${language}

Rules:
- Start with the greeting provided (do NOT create your own)
- Be brief (3-5 sentences max)
- Be clear and professional
- No fluff or filler
- Never promise specific timelines
- If you don't have enough info, ask a clarifying question
- Sign off as "Winlab ${team.charAt(0).toUpperCase() + team.slice(1)} Team"`,
      messages: [
        {
          role: 'user',
          content: `Customer email:\nSubject: ${subject}\n\n${body}\n\nDraft a professional response.`,
        },
      ],
    });

    return response.content?.[0]?.text || `${greeting}\n\nThank you for contacting us. We're looking into this and will respond shortly.\n\n— Winlab ${team.charAt(0).toUpperCase() + team.slice(1)} Team`;
  } catch (error) {
    console.error('AI reply generation failed:', error.message);
    return `${greeting}\n\nThank you for contacting Winlab. We've received your message and will respond shortly.\n\n— Winlab Support Team`;
  }
}

/**
 * Send a reply with full pipeline tracking
 * @param {object} params - { to, subject, body, team, ticketId }
 * @returns {Promise<object>} Send result
 */
export async function sendReply(params) {
  const result = await sendHelpdeskReply(params);

  // Save verification record
  const verifyRecord = {
    ticketId: params.ticketId,
    emailId: result.emailId,
    trackingId: result.trackingId,
    verificationCode: result.verificationCode,
    verifyToken: result.verifyToken,
    sentAt: Date.now(),
    team: params.team,
  };

  return { ...result, verifyRecord };
}

// Default export — the full pipeline
export default { processIncomingEmail, sendReply };
