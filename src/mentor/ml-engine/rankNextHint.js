/**
 * rankNextHint
 *
 * Given the current lab state classification and failure layer,
 * selects the most appropriate next hint from the lab's mentor steps.
 *
 * Does NOT call an LLM — uses deterministic ranking based on:
 *   - current phase
 *   - detected failure layer
 *   - hints already shown
 *
 * Falls back to sequential delivery if no better signal is available.
 */

/**
 * @typedef {Object} HintSelection
 * @property {number}      stepIndex   - 0-based index into hint list
 * @property {string}      content     - Full hint content to show
 * @property {string}      rationale   - Why this hint was selected
 * @property {'soft'|'medium'|'strong'|'fix'} level
 */

const HINT_LEVELS = ['soft', 'medium', 'strong', 'fix'];

/**
 * Maps failure layer index (1-based) to hint step index (0-based).
 * Layer 1 → hints 0-1 (orientation)
 * Layer 2 → hints 2-3 (specific fix)
 */
function layerToHintRange(layer) {
  if (layer === 1) return [0, 1];
  if (layer === 2) return [2, 3];
  return [0, 3];
}

/**
 * @param {object} params
 * @param {string[]}  params.hints          - Hint contents in order (from mentor/step*.txt or MENTOR_HINTS)
 * @param {number[]}  params.shownIndices   - Indices of hints already shown
 * @param {import('./classifyLabState').LabStateClassification} params.classification
 * @param {import('./detectFailureLayer').FailureLayer|null}    params.failureLayer
 * @returns {HintSelection|null}            - null if all hints have been shown
 */
export function rankNextHint({ hints, shownIndices, classification, failureLayer }) {
  if (!hints || hints.length === 0) return null;

  const shown = new Set(shownIndices);
  const { phase } = classification;

  // All hints exhausted
  if (shown.size >= hints.length) return null;

  let targetIndex = null;
  let rationale   = '';

  // If we know the failure layer, jump to the relevant hint range
  if (failureLayer) {
    const [rangeStart, rangeEnd] = layerToHintRange(failureLayer.layer);
    for (let i = rangeStart; i <= rangeEnd && i < hints.length; i++) {
      if (!shown.has(i)) {
        targetIndex = i;
        rationale = `layer ${failureLayer.layer} detected (${failureLayer.id}) → targeting hint ${i + 1}`;
        break;
      }
    }
  }

  // Phase-based selection if no layer-based target found
  if (targetIndex === null) {
    if (phase === 'idle' || phase === 'exploring') {
      // Give soft hint first
      for (let i = 0; i < Math.min(2, hints.length); i++) {
        if (!shown.has(i)) { targetIndex = i; rationale = `phase=${phase}, giving orientation hint`; break; }
      }
    } else if (phase === 'diagnosed') {
      // Skip to medium/strong hint
      const start = Math.min(1, hints.length - 1);
      for (let i = start; i < hints.length; i++) {
        if (!shown.has(i)) { targetIndex = i; rationale = `phase=diagnosed, skipping to actionable hint`; break; }
      }
    } else if (phase === 'stuck') {
      // Give the strongest unshown hint
      for (let i = hints.length - 1; i >= 0; i--) {
        if (!shown.has(i)) { targetIndex = i; rationale = `phase=stuck, giving strongest available hint`; break; }
      }
    }
  }

  // Fallback: next sequential unshown hint
  if (targetIndex === null) {
    for (let i = 0; i < hints.length; i++) {
      if (!shown.has(i)) { targetIndex = i; rationale = 'sequential fallback'; break; }
    }
  }

  if (targetIndex === null) return null;

  return {
    stepIndex: targetIndex,
    content:   hints[targetIndex],
    level:     HINT_LEVELS[Math.min(targetIndex, HINT_LEVELS.length - 1)],
    rationale,
  };
}
