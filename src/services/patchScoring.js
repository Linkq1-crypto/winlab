export function scorePatchQuality({
  verifyOk,
  attempts,
  filesTouched = [],
  patchBytes = 0,
  timeout = false,
  touchedOutsideEntrypointZone = false,
  warningLikeOutput = false,
  level = null,
  durationMs = 0,
  usedAI = true,
}) {
  let score = 100;
  const reasons = [];

  if (!verifyOk) {
    score -= 40;
    reasons.push("verification_failed");
  }

  const extraFiles = Math.max(0, filesTouched.length - 1);
  if (extraFiles > 0) {
    const penalty = extraFiles * 10;
    score -= penalty;
    reasons.push(`extra_files_${extraFiles}`);
  }

  if ((attempts || 1) > 1) {
    score -= 15;
    reasons.push("needed_retry");
  }

  if (patchBytes > 8 * 1024) {
    score -= 10;
    reasons.push("large_patch");
  }

  if (touchedOutsideEntrypointZone) {
    score -= 15;
    reasons.push("broad_scope_touch");
  }

  if (warningLikeOutput) {
    score -= 10;
    reasons.push("warning_output");
  }

  if (timeout) {
    score -= 20;
    reasons.push("timeout");
  }

  if (verifyOk && filesTouched.length === 1) {
    score += 5;
    reasons.push("single_file_bonus");
  }

  if (verifyOk && (attempts || 1) === 1) {
    score += 5;
    reasons.push("first_try_bonus");
  }

  if (level?.scoring) {
    const levelScore = computeScore({
      level,
      attempts: attempts || 1,
      durationMs,
      usedAI,
      success: !!verifyOk,
    });
    score = Math.min(score, levelScore.score);
    reasons.push(`level_${String(level.id || "unknown").toLowerCase()}`);
    if (!usedAI) reasons.push("no_ai_bonus");
  }

  score = Math.max(0, Math.min(100, score));

  let grade = "C";
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";

  return { score, grade, reasons };
}

export function computeScore({
  level,
  attempts = 1,
  durationMs = 0,
  usedAI = true,
  success,
}) {
  if (!success) return { score: 0, grade: "F" };

  let score = level.scoring.base;
  score -= Math.max(0, attempts || 1) * level.scoring.penaltyPerAttempt;
  score -= Math.floor((durationMs / 1000) * level.scoring.timeWeight);

  if ((attempts || 1) === 1) {
    score += level.scoring.bonusFirstTry;
  }

  if (!usedAI) {
    score += level.scoring.bonusNoAI;
  }

  score = Math.max(0, Math.min(100, score));
  return { score, grade: gradeFromScore(score) };
}

export function gradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export default { computeScore, gradeFromScore, scorePatchQuality };
