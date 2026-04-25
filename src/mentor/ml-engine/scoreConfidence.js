/**
 * scoreConfidence
 *
 * Aggregates signals from classifyLabState and detectFailureLayer
 * into a single confidence score for the mentor's current diagnosis.
 *
 * Used to decide:
 *   - whether to proactively show a hint
 *   - how assertive the hint language should be
 *   - when to escalate to full AI call
 */

/**
 * @typedef {Object} ConfidenceScore
 * @property {number}           score    - 0 to 1
 * @property {'low'|'medium'|'high'} grade
 * @property {string[]}         signals  - Contributing factors
 * @property {boolean}          shouldProactiveHint
 * @property {boolean}          shouldEscalateToAI
 */

const WEIGHTS = {
  classificationConfidence: 0.4,
  failureLayerConfidence:   0.4,
  commandCount:             0.1,
  verifyAttempted:          0.1,
};

/**
 * @param {object} params
 * @param {import('./classifyLabState').LabStateClassification} params.classification
 * @param {import('./detectFailureLayer').FailureLayer|null}    params.failureLayer
 * @param {string[]} params.commandHistory
 * @param {string|null} params.verifyResult
 * @returns {ConfidenceScore}
 */
export function scoreConfidence({ classification, failureLayer, commandHistory = [], verifyResult }) {
  const signals = [];
  let score = 0;

  // Classification confidence
  const classConf = classification?.confidence ?? 0;
  score += classConf * WEIGHTS.classificationConfidence;
  signals.push(`classification(${classification?.phase}) confidence=${classConf.toFixed(2)}`);

  // Failure layer confidence
  if (failureLayer) {
    score += failureLayer.confidence * WEIGHTS.failureLayerConfidence;
    signals.push(`failure layer ${failureLayer.layer} (${failureLayer.id}) confidence=${failureLayer.confidence.toFixed(2)}`);
  } else {
    signals.push('no failure layer detected');
  }

  // Command count signal — more commands = more context
  const cmdScore = Math.min(commandHistory.length / 5, 1);
  score += cmdScore * WEIGHTS.commandCount;
  signals.push(`${commandHistory.length} command(s) run`);

  // Verify attempted
  if (verifyResult) {
    score += 1 * WEIGHTS.verifyAttempted;
    signals.push(`verify attempted: ${verifyResult.startsWith('VERIFY_OK') ? 'passed' : 'failed'}`);
  }

  score = Math.min(score, 1);

  const grade = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low';

  // Proactive hint: medium+ confidence + stuck/exploring phase
  const shouldProactiveHint = score >= 0.4 &&
    (classification?.phase === 'stuck' || classification?.phase === 'exploring');

  // Escalate to AI: low confidence + user is stuck
  const shouldEscalateToAI = score < 0.4 && classification?.phase === 'stuck';

  return { score, grade, signals, shouldProactiveHint, shouldEscalateToAI };
}
