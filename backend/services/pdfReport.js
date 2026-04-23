// winlab / backend / services / pdfReport.js

const fs = require("fs");
const path = require("path");

function generatePDF(report) {
  const filePath = path.join(__dirname, `../../tmp/report-${report.sessionId}.txt`);

  const content = `WINLAB ASSESSMENT REPORT\n\nSession: ${report.sessionId}\nScore: ${report.score}\nLevel: ${report.level}\n\nStrengths:\n- ${report.aiSummary.strengths.join("\n- ")}\n\nWeaknesses:\n- ${report.aiSummary.weaknesses.join("\n- ")}\n\nReplay: ${report.replay}\n`;

  fs.writeFileSync(filePath, content);

  return filePath;
}

module.exports = {
  generatePDF
};
