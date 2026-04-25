/**
 * classifyLabState
 *
 * Analyzes lab context (commands, output, elapsed time) and returns
 * a classification of where the user is in the problem-solving process.
 *
 * Input:  LabStateSnapshot
 * Output: LabStateClassification
 */

/**
 * @typedef {Object} LabStateSnapshot
 * @property {string}   labId
 * @property {string[]} commandHistory   - Commands run so far
 * @property {string}   terminalOutput   - Latest terminal output (last ~500 chars)
 * @property {string|null} verifyResult  - "VERIFY_OK" | "VERIFY_FAIL ..." | null
 * @property {number}   elapsedMinutes
 */

/**
 * @typedef {Object} LabStateClassification
 * @property {'idle'|'exploring'|'diagnosed'|'fixing'|'stuck'|'done'} phase
 * @property {number}   confidence  - 0 to 1
 * @property {string[]} indicators  - Human-readable evidence for this classification
 */

const EXPLORATION_COMMANDS = [
  'systemctl', 'journalctl', 'ss ', 'netstat', 'ps ', 'top', 'htop',
  'cat /etc', 'ls /etc', 'nginx -t', 'grep', 'tail', 'df ', 'du ',
  'free ', 'dmesg', 'lsof', 'strace', 'tcpdump',
];

const FIX_COMMANDS = [
  'rm ', 'mv ', 'cp ', 'chmod', 'chown', 'sed ', 'tee ',
  'systemctl start', 'systemctl restart', 'systemctl stop', 'systemctl enable',
  'nginx', 'service ', 'kill ', 'pkill',
];

const DIAGNOSIS_SIGNALS = [
  'duplicate default_server', 'bind() failed', 'address already in use',
  'permission denied', 'no space left', 'connection refused',
  'failed to start', 'table is locked', 'out of memory',
  'replica lag', 'sql thread stopped',
];

function countMatches(haystack, needles) {
  const lower = haystack.toLowerCase();
  return needles.filter(n => lower.includes(n.toLowerCase())).length;
}

/**
 * @param {LabStateSnapshot} snapshot
 * @returns {LabStateClassification}
 */
export function classifyLabState(snapshot) {
  const { commandHistory = [], terminalOutput = '', verifyResult, elapsedMinutes = 0 } = snapshot;
  const allCommands = commandHistory.join(' ').toLowerCase();
  const output      = terminalOutput.toLowerCase();
  const indicators  = [];

  // Done
  if (verifyResult && verifyResult.startsWith('VERIFY_OK')) {
    return { phase: 'done', confidence: 1, indicators: ['verify.sh passed'] };
  }

  // Stuck: no commands in a long time
  if (elapsedMinutes > 10 && commandHistory.length < 2) {
    indicators.push(`${elapsedMinutes}m elapsed with only ${commandHistory.length} command(s)`);
    return { phase: 'stuck', confidence: 0.8, indicators };
  }

  const explorationCount = countMatches(allCommands, EXPLORATION_COMMANDS);
  const fixCount         = countMatches(allCommands, FIX_COMMANDS);
  const diagnosisSignals = countMatches(output, DIAGNOSIS_SIGNALS);

  // Fixing: ran fix commands after exploring
  if (fixCount >= 1 && explorationCount >= 1) {
    indicators.push(`ran ${fixCount} fix command(s) after ${explorationCount} exploration command(s)`);
    if (diagnosisSignals > 0) indicators.push('error pattern identified in output');
    return { phase: 'fixing', confidence: 0.75 + Math.min(fixCount * 0.05, 0.2), indicators };
  }

  // Diagnosed: error pattern found in output
  if (diagnosisSignals >= 1) {
    indicators.push(`error pattern found in output (${diagnosisSignals} signal(s))`);
    indicators.push(`explored with ${explorationCount} command(s)`);
    return { phase: 'diagnosed', confidence: 0.7 + Math.min(diagnosisSignals * 0.1, 0.25), indicators };
  }

  // Exploring: commands run but no clear signal yet
  if (explorationCount >= 1 || commandHistory.length >= 1) {
    indicators.push(`${commandHistory.length} command(s) run, no error pattern matched yet`);
    return { phase: 'exploring', confidence: 0.6, indicators };
  }

  indicators.push('no commands run yet');
  return { phase: 'idle', confidence: 0.9, indicators };
}
