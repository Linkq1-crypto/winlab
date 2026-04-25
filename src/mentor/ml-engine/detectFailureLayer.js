/**
 * detectFailureLayer
 *
 * Identifies which failure layer is currently active based on
 * terminal output and command history. Labs can have multiple
 * ordered failure layers — fixing layer 1 exposes layer 2.
 *
 * Failure layers are defined per lab in a registry.
 * If no lab-specific registry matches, falls back to generic signals.
 */

/**
 * @typedef {Object} FailureLayer
 * @property {number}   layer       - 1-based index
 * @property {string}   id          - Machine-readable ID
 * @property {string}   description - Human-readable description
 * @property {string[]} evidence    - Matched signals from output
 * @property {number}   confidence  - 0 to 1
 */

/**
 * Lab-specific failure layer registry.
 * Each entry: array of layers ordered by detection priority.
 * A layer is matched if ANY of its signals appears in terminal output.
 */
const LAB_FAILURE_LAYERS = {
  'nginx-port-conflict': [
    {
      layer: 1,
      id: 'port_occupied',
      description: 'Port 80 is occupied by another process',
      signals: ['address already in use', 'bind() failed', 'eaddrinuse', '(98: address already in use)'],
    },
    {
      layer: 2,
      id: 'duplicate_default_server',
      description: 'Duplicate default_server on port 80 in nginx config',
      signals: ['duplicate default server', 'duplicate default_server', 'conflicting server name'],
    },
  ],
  'disk-full': [
    {
      layer: 1,
      id: 'filesystem_full',
      description: 'Filesystem is at 100% capacity',
      signals: ['no space left on device', '100%', 'disk full'],
    },
    {
      layer: 2,
      id: 'service_degraded',
      description: 'Service cannot write logs or state after disk was freed',
      signals: ['failed to write', 'cannot open for writing', 'read-only file system'],
    },
  ],
  'memory-leak': [
    {
      layer: 1,
      id: 'oom_kill',
      description: 'Process killed by OOM killer',
      signals: ['out of memory', 'oom-kill', 'killed process', 'cannot allocate memory'],
    },
    {
      layer: 2,
      id: 'heap_growth',
      description: 'Heap growing unbounded — leak still active',
      signals: ['heapused', 'heap growing', 'rss increasing'],
    },
  ],
  'db-dead': [
    {
      layer: 1,
      id: 'service_down',
      description: 'Database service is not running',
      signals: ['connection refused', 'can\'t connect to local mysql', 'no such file or directory'],
    },
    {
      layer: 2,
      id: 'data_corruption',
      description: 'Database files are corrupted or tables are damaged',
      signals: ['table is marked as crashed', 'incorrect key file', 'innodb: corruption'],
    },
  ],
  'permission-denied': [
    {
      layer: 1,
      id: 'unix_permission',
      description: 'Unix file permissions block access',
      signals: ['permission denied', 'eacces', 'cannot open'],
    },
    {
      layer: 2,
      id: 'selinux_block',
      description: 'SELinux or AppArmor blocking access despite correct permissions',
      signals: ['avc:', 'selinux', 'apparmor', 'audit: type=1400'],
    },
  ],
};

const GENERIC_LAYERS = [
  {
    layer: 1,
    id: 'service_down',
    description: 'Service is not running',
    signals: ['failed', 'not running', 'inactive', 'connection refused'],
  },
  {
    layer: 2,
    id: 'config_error',
    description: 'Configuration error preventing service start',
    signals: ['configuration error', 'syntax error', 'invalid', 'failed to load'],
  },
];

/**
 * @param {string} labId
 * @param {string} terminalOutput
 * @returns {FailureLayer|null}
 */
export function detectFailureLayer(labId, terminalOutput) {
  const output = terminalOutput.toLowerCase();
  const layers = LAB_FAILURE_LAYERS[labId] ?? GENERIC_LAYERS;

  for (const def of layers) {
    const matched = def.signals.filter(s => output.includes(s));
    if (matched.length > 0) {
      return {
        layer:       def.layer,
        id:          def.id,
        description: def.description,
        evidence:    matched,
        confidence:  Math.min(0.6 + matched.length * 0.15, 0.95),
      };
    }
  }

  return null;
}

/**
 * Returns all layers defined for a lab — useful for building
 * the full diagnosis tree in the mentor UI.
 *
 * @param {string} labId
 * @returns {Array}
 */
export function getLabLayers(labId) {
  return LAB_FAILURE_LAYERS[labId] ?? GENERIC_LAYERS;
}
