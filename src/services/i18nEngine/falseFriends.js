/**
 * False Friends + Universal Keep-in-English list.
 *
 * Two layers:
 * 1. KEEP_EN — tech terms used globally in English in the industry.
 *    Never translate these regardless of target language.
 * 2. FALSE_FRIENDS — per-language terms that LOOK translatable but
 *    produce wrong meaning. Keep the English form instead.
 */

// DevOps/SRE terms universally used in English — never translate
export const KEEP_EN = [
  'deploy', 'deployment', 'pipeline', 'queue', 'worker', 'cluster',
  'node', 'pod', 'container', 'image', 'volume', 'shard', 'replica',
  'staging', 'production', 'rollback', 'rollout', 'canary', 'blue-green',
  'incident', 'outage', 'postmortem', 'runbook', 'playbook',
  'dashboard', 'monitoring', 'alert', 'metric', 'log', 'trace',
  'timeout', 'retry', 'backoff', 'circuit breaker', 'rate limit',
  'endpoint', 'payload', 'webhook', 'token', 'secret', 'vault',
  'namespace', 'ingress', 'egress', 'proxy', 'load balancer',
  'autoscaling', 'health check', 'liveness', 'readiness',
  'cron', 'job', 'task', 'event', 'stream', 'topic', 'consumer',
  'commit', 'branch', 'merge', 'pull request', 'release', 'tag',
  'debug', 'crash', 'panic', 'stacktrace', 'core dump',
];

// Per-language false friends: { lang → { wrongTranslation: keepEnglish } }
// Key = what an LLM might produce, value = what to use instead
export const FALSE_FRIENDS = {
  de: {
    'Protokoll': 'log',           // German "Protokoll" sounds like protocol but ≠ log
    'aktuell':   'current',       // "aktuell" ≠ "actual" (false friend)
    'Befehl':    'command',       // "Befehl" = order/command, but keep "command" in DevOps
    'Dienst':    'service',       // keep "service" not "Dienst"
    'Warteschlange': 'queue',     // keep "queue"
  },
  fr: {
    'réaliser':  'implement',     // "réaliser" ≠ "realize"
    'actuel':    'current',       // "actuel" ≠ "actual"
    'file':      'queue',         // "file d'attente" → keep "queue"
    'nœud':      'node',          // keep "node"
    'grappe':    'cluster',       // keep "cluster"
    'démon':     'daemon',        // "démon" sounds right but keep "daemon"
  },
  es: {
    'realizar':  'implement',     // "realizar" ≠ "realize"
    'actual':    'current',       // "actual" ≠ "actual"
    'éxito':     'success',       // ok but keep consistent
    'cola':      'queue',         // keep "queue" not "cola" in DevOps context
    'nodo':      'node',          // keep "node"
    'racimo':    'cluster',       // keep "cluster"
  },
  pt: {
    'realizar':  'implement',
    'atual':     'current',
    'fila':      'queue',
    'nó':        'node',
    'aglomerado':'cluster',
  },
};

/**
 * Returns the system-prompt injection for false friends + keep-in-English.
 * Injected into the LLM prompt so it enforces these rules at generation time.
 */
export function getFalseFriendsPrompt(targetLang) {
  const langFF = FALSE_FRIENDS[targetLang] || {};
  const ffLines = Object.entries(langFF)
    .map(([wrong, keep]) => `  - Do NOT use "${wrong}" → keep "${keep}" instead`)
    .join('\n');

  return `
Tech terms to NEVER translate (keep in English exactly as-is):
${KEEP_EN.map(t => `  "${t}"`).join(', ')}

False friends for ${targetLang} — use the English form:
${ffLines || '  (none defined for this language)'}
`.trim();
}
