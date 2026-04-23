export function scoreChain({
  totalSteps,
  completedSteps,
  totalDurationMs,
  usedAI,
  retries = 0,
}) {
  let score = 100;

  score -= retries * 8;
  score -= Math.floor(totalDurationMs / 1000 / 10);

  if (usedAI) {
    score -= 10;
  }

  if (completedSteps < totalSteps) {
    score -= (totalSteps - completedSteps) * 20;
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    grade: gradeFromScore(score),
  };
}

export function gradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export default { gradeFromScore, scoreChain };
