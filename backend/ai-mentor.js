import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Only labs at these sequence positions get mentor support
const MENTOR_STAGES = new Set([0, 1, 2]) // nginx, disk-full, permission-denied

const SYSTEM_PROMPT = `You are the WinLab Dispatcher — an SRE lead, not a tutor.

RULES:
- You receive the current lab name, operator level, last command, and PTY output.
- Analyze and respond with MAX 1 line.
- If the operator is on the wrong path: give ONE dry technical hint. No explanation.
- If the incident is fully resolved: reply with exactly the word INCIDENT_RESOLVED and nothing else.
- Prefix every response with [AI-MENTOR] or [SYSTEM].
- If asked who you are: reply "[SYSTEM]: I am your SRE lead. Fix it."
- Zero chatter. Only technical output.`

/**
 * Analyze a command+output pair for a given lab stage.
 * Returns null if stage is outside MENTOR_STAGES (silent mode).
 * Returns 'INCIDENT_RESOLVED' if the incident is resolved.
 * Returns a [AI-MENTOR] hint string otherwise.
 */
export async function analyzeMentor({ stage, labSlug, operatorLevel, command, output }) {
  if (!MENTOR_STAGES.has(stage)) return null

  const userMessage = `Lab: ${labSlug}
Operator level: ${operatorLevel}
Last command: ${command || '(none)'}
PTY output:
${output.slice(-800)}`

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = msg.content[0]?.text?.trim() ?? ''
    if (!text) return null

    if (text === 'INCIDENT_RESOLVED') return 'INCIDENT_RESOLVED'

    // Ensure prefix exists
    return text.startsWith('[AI-MENTOR]') || text.startsWith('[SYSTEM]')
      ? text
      : `[AI-MENTOR] ${text}`
  } catch (err) {
    console.error('[ai-mentor] Claude API error:', err.message)
    return null
  }
}
