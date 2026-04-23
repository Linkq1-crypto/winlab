import { buildLabPrompt } from "./promptBuilder.js";

function wasPatchApplied(applyResult) {
  if (!applyResult) return false;
  if (typeof applyResult.applied === "boolean") return applyResult.applied;
  if (typeof applyResult.ok === "boolean") return applyResult.ok && !applyResult.skipped;
  return false;
}

function normalizeApplyResult(applyResult) {
  return {
    ...(applyResult || {}),
    applied: wasPatchApplied(applyResult),
  };
}

export function shouldRetryPatch({ patchApplied, verifyResult, patchMeta }) {
  if (!patchApplied) return false;
  if (!verifyResult) return false;
  if (verifyResult.ok) return false;
  if (verifyResult.skipped) return false;

  if (patchMeta?.invalidDiff) return false;
  if (patchMeta?.pathViolation) return false;
  if (patchMeta?.emptyPatch) return false;
  if (patchMeta?.policyViolation) return false;

  return true;
}

export function buildRetryPromptContext(verifyResult) {
  return {
    verifyOk: verifyResult?.ok ?? false,
    timeout: verifyResult?.timeout ?? verifyResult?.timedOut ?? false,
    outputSnippet: verifyResult?.output || "",
  };
}

export async function runPatchWithRetry({
  labId,
  lab = null,
  aiRunner,
  applyPatch,
  runVerify,
  workspace,
  level = "JUNIOR",
  incident = null,
}) {
  const attempts = [];

  const prompt1 = buildLabPrompt({ labId, mode: "patch", lab, level, incident });
  const first = await aiRunner(prompt1);
  const firstPatch = first?.diff || first?.result?.diff || first;
  const firstApply = normalizeApplyResult(await applyPatch(workspace, firstPatch));
  const firstVerify = firstApply.applied
    ? await runVerify()
    : { ok: false, output: "Patch not applied" };

  attempts.push({
    attempt: 1,
    prompt: prompt1,
    patch: first,
    apply: firstApply,
    verify: firstVerify,
  });

  if (firstVerify.ok) {
    return {
      ok: true,
      finalAttempt: 1,
      attempts,
    };
  }

  if (
    !shouldRetryPatch({
      patchApplied: firstApply.applied,
      verifyResult: firstVerify,
      patchMeta: firstApply,
    })
  ) {
    return {
      ok: false,
      finalAttempt: 1,
      attempts,
    };
  }

  const retryContext = buildRetryPromptContext(firstVerify);
  const prompt2 = buildLabPrompt({
    labId,
    mode: "patch",
    failureContext: retryContext,
    lab,
    level,
    incident,
  });

  const second = await aiRunner(prompt2);
  const secondPatch = second?.diff || second?.result?.diff || second;
  const secondApply = normalizeApplyResult(await applyPatch(workspace, secondPatch));
  const secondVerify = secondApply.applied
    ? await runVerify()
    : { ok: false, output: "Retry patch not applied" };

  attempts.push({
    attempt: 2,
    prompt: prompt2,
    patch: second,
    apply: secondApply,
    verify: secondVerify,
  });

  return {
    ok: secondVerify.ok,
    finalAttempt: 2,
    attempts,
  };
}

export const _test = {
  normalizeApplyResult,
  wasPatchApplied,
};

export default { buildRetryPromptContext, runPatchWithRetry, shouldRetryPatch };
