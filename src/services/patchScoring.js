export function scorePatchQuality({
  verifyOk,
  attempts,
  filesTouched = [],
  patchBytes = 0,
  timeout = false,
  touchedOutsideEntrypointZone = false,
  warningLikeOutput = false,
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

  score = Math.max(0, Math.min(100, score));

  let grade = "C";
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";

  return { score, grade, reasons };
}

export default { scorePatchQuality };
