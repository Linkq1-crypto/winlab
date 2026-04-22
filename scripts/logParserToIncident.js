// Intelligent parser: converts raw logs / systemctl output into incident modules
// usage: node scripts/logParserToIncident.js input.log outputName

import fs from 'fs';

const inputFile = process.argv[2];
const name = process.argv[3] || 'generated_incident';

if (!inputFile) {
  console.error('Provide log file');
  process.exit(1);
}

const raw = fs.readFileSync(inputFile, 'utf-8');

function extractPatterns(log) {
  const patterns = [];

  const lines = log.split('\n');

  lines.forEach(l => {
    if (l.includes('failed') || l.includes('error')) {
      patterns.push({
        match: l.trim(),
        type: 'error'
      });
    }

    if (l.includes('Active:')) {
      patterns.push({
        match: l.trim(),
        type: 'status'
      });
    }

    if (l.includes('port') || l.includes('address already in use')) {
      patterns.push({
        match: l.trim(),
        type: 'network'
      });
    }
  });

  return patterns;
}

function generateIncident(name, patterns) {
  return `export default {
  id: "${name}",

  initialState: {
    issue: true
  },

  handle(cmd, state) {
    cmd = cmd.toLowerCase();

    if (cmd.includes("status") || cmd.includes("systemctl")) {
      return {
        output: ` + "`" + patterns.map(p => p.match).join("\\n") + "`" + `,
        state
      };
    }

    if (cmd.includes("restart") || cmd.includes("fix")) {
      return {
        output: "issue resolved",
        state: { ...state, issue: false }
      };
    }

    return { output: "command not found", state };
  },

  isSolved(state) {
    return state.issue === false;
  }
};`;
}

const patterns = extractPatterns(raw);

const code = generateIncident(name, patterns);

fs.writeFileSync(`./src/incidents/${name}.js`, code);

console.log(`✔ generated incident from logs: ${name}`);
