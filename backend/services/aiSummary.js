// winlab / backend / services / aiSummary.js

// Lightweight AI summary layer (plug into your existing AI observer later)

function analyzeTimeline(events = []) {
  let commands = events.map(e => e.cmd || "");

  const strengths = [];
  const weaknesses = [];

  // very first heuristic layer (replace with LLM later)
  if (commands.some(c => c.includes("netstat") || c.includes("ss"))) {
    strengths.push("networking");
  }

  if (commands.some(c => c.includes("chmod") || c.includes("chown"))) {
    strengths.push("permissions awareness");
  }

  if (commands.filter(c => c.includes("sudo")).length > 5) {
    weaknesses.push("over-reliance on sudo");
  }

  if (commands.length < 5) {
    weaknesses.push("low exploration");
  }

  return {
    strengths,
    weaknesses
  };
}

module.exports = {
  analyzeTimeline
};
