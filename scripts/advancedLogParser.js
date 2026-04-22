// ADVANCED PARSER: root cause + suggested commands + multi-step incidents
// usage: node scripts/advancedLogParser.js input.log outputName

import fs from 'fs';

const inputFile = process.argv[2];
const name = process.argv[3] || 'advanced_incident';

if (!inputFile) {
  console.error('Provide log file');
  process.exit(1);
}

const raw = fs.readFileSync(inputFile, 'utf-8');

function detectRootCause(log) {
  if (log.includes('address already in use')) return 'port_conflict';
  if (log.includes('disk full') || log.includes('No space left')) return 'disk_full';
  if (log.includes('failed') && log.includes('nginx')) return 'nginx_down';
  return 'unknown';
}

function suggestFix(cause) {
  switch (cause) {
    case 'port_conflict':
      return ['lsof -i :80', 'kill -9 <pid>', 'restart nginx'];
    case 'disk_full':
      return ['df -h', 'rm -rf /tmp/*', 'restart service'];
    case 'nginx_down':
      return ['systemctl status nginx', 'systemctl restart nginx'];
    default:
      return ['check logs', 'restart service'];
  }
}

function generateIncident(name, cause, commands, log) {
  return `export default {
  id: "${name}",

  initialState: {
    cause: "${cause}",
    step: 0
  },

  handle(cmd, state) {
    cmd = cmd.toLowerCase();

    if (cmd.includes("status") || cmd.includes("log")) {
      return {
        output: ` + "`" + log.replace(/`/g, '') + "`" + `,
        state
      };
    }

    const steps = ${JSON.stringify(commands)};

    if (cmd.includes(steps[state.step])) {
      const nextStep = state.step + 1;

      if (nextStep >= steps.length) {
        return {
          output: "incident fully resolved",
          state: { ...state, step: nextStep, solved: true }
        };
      }

      return {
        output: "step ok",
        state: { ...state, step: nextStep }
      };
    }

    return { output: "command not effective", state };
  },

  isSolved(state) {
    return state.solved === true;
  }
};`;
}

const cause = detectRootCause(raw);
const commands = suggestFix(cause);

const code = generateIncident(name, cause, commands, raw);

fs.writeFileSync(`./src/incidents/${name}.js`, code);

console.log(`✔ advanced incident generated: ${name}`);
