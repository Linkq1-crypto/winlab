// AUTO-CONVERTER: transforms raw lab JSON into incident modules
// run with: node scripts/convertLabsToIncidents.js

import fs from 'fs';
import path from 'path';

const INPUT_DIR = './labs';
const OUTPUT_DIR = './src/incidents';

function generateIncident(name, data) {
  return `export default {
  id: "${name}",

  initialState: {},

  handle(cmd, state) {
    cmd = cmd.toLowerCase();

    ${data.commands.map(c => `if (cmd.includes("${c.input}")) {
      return { output: "${c.output}", state };
    }`).join("\n\n    ")}

    return { output: "command not found", state };
  },

  isSolved(state) {
    return false; // TODO: customize per lab
  }
};`;
}

function run() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(INPUT_DIR);

  files.forEach(file => {
    if (!file.endsWith('.json')) return;

    const raw = JSON.parse(fs.readFileSync(path.join(INPUT_DIR, file)));

    const name = file.replace('.json', '');

    const incidentCode = generateIncident(name, raw);

    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${name}.js`),
      incidentCode
    );

    console.log(`✔ converted ${name}`);
  });
}

run();
