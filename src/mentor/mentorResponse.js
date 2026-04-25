/**
 * mentorResponse
 *
 * Unified entry point for the AI Mentor.
 * Runs the ML pipeline locally before (optionally) calling the LLM API.
 *
 * Pipeline:
 *   1. classifyLabState    — where is the user in the problem?
 *   2. detectFailureLayer  — which specific failure is active?
 *   3. scoreConfidence     — how certain is the diagnosis?
 *   4. rankNextHint        — which hint should come next?
 *   5. → return hint directly if confidence is high enough
 *   6. → escalate to LLM (/api/ai/help) if confidence is low or user explicitly asked
 *
 * This keeps the LLM as a fallback, not the default path.
 */

import { classifyLabState }  from './ml-engine/classifyLabState.js';
import { detectFailureLayer } from './ml-engine/detectFailureLayer.js';
import { rankNextHint }       from './ml-engine/rankNextHint.js';
import { scoreConfidence }    from './ml-engine/scoreConfidence.js';

/**
 * @typedef {Object} MentorRequest
 * @property {string}   labId
 * @property {string[]} commandHistory
 * @property {string}   terminalOutput
 * @property {string|null} verifyResult
 * @property {number}   elapsedMinutes
 * @property {string[]} hints              - Ordered hint contents from mentor/step*.txt
 * @property {number[]} shownHintIndices   - Hint indices already shown this session
 * @property {string}   userQuestion       - Optional: explicit user question
 * @property {boolean}  forceAI            - Force LLM call regardless of confidence
 */

/**
 * @typedef {Object} MentorResponse
 * @property {'hint'|'ai'|'done'|'none'} type
 * @property {string}  content             - Text to show in mentor UI
 * @property {object}  debug               - Internal signals (for telemetry)
 */

/**
 * @param {MentorRequest} req
 * @param {Function} callLLM  - async (prompt: string) => string
 * @returns {Promise<MentorResponse>}
 */
export async function getMentorResponse(req, callLLM) {
  const {
    labId, commandHistory, terminalOutput, verifyResult,
    elapsedMinutes, hints, shownHintIndices, userQuestion, forceAI,
  } = req;

  // Step 1-3: ML pipeline
  const classification = classifyLabState({
    labId, commandHistory, terminalOutput, verifyResult, elapsedMinutes,
  });

  const failureLayer = detectFailureLayer(labId, terminalOutput);

  const confidence = scoreConfidence({
    classification, failureLayer, commandHistory, verifyResult,
  });

  const debug = { classification, failureLayer, confidence };

  // Done
  if (classification.phase === 'done') {
    return { type: 'done', content: 'Lab complete. Verification passed.', debug };
  }

  // Explicit user question or low confidence → go to LLM
  if (forceAI || userQuestion || confidence.shouldEscalateToAI) {
    const prompt = buildLLMPrompt({ labId, commandHistory, terminalOutput, verifyResult, userQuestion, failureLayer });
    const aiContent = await callLLM(prompt);
    return { type: 'ai', content: aiContent, debug };
  }

  // High confidence → serve local hint
  const hint = rankNextHint({
    hints,
    shownIndices: shownHintIndices,
    classification,
    failureLayer,
  });

  if (hint) {
    return { type: 'hint', content: hint.content, debug: { ...debug, hint } };
  }

  // All hints exhausted → escalate to LLM
  const prompt = buildLLMPrompt({ labId, commandHistory, terminalOutput, verifyResult, userQuestion: null, failureLayer });
  const aiContent = await callLLM(prompt);
  return { type: 'ai', content: aiContent, debug };
}

function buildLLMPrompt({ labId, commandHistory, terminalOutput, verifyResult, userQuestion, failureLayer }) {
  const parts = [
    `Lab: ${labId}`,
    `Commands run: ${commandHistory.slice(-10).join(', ') || 'none'}`,
    `Terminal output (last 300 chars): ${terminalOutput.slice(-300) || 'empty'}`,
  ];
  if (verifyResult) parts.push(`Verify result: ${verifyResult}`);
  if (failureLayer) parts.push(`Detected failure: ${failureLayer.description} (layer ${failureLayer.layer})`);
  if (userQuestion) parts.push(`User question: ${userQuestion}`);

  return [
    'You are a senior Linux SRE mentor. Be concise. Give the next single actionable step.',
    ...parts,
  ].join('\n');
}
