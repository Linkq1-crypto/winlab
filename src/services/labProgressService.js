import prisma from "../lib/prisma.js";

export async function recordLabAttempt({
  userId,
  labId,
  mode,
  result,
}) {
  if (!userId) throw new Error("userId is required");
  if (!labId) throw new Error("labId is required");
  if (mode !== "review" && mode !== "patch") {
    throw new Error("mode must be review or patch");
  }

  const success = !!result?.ok;
  const score = result?.result?.quality?.score ?? null;
  const grade = result?.result?.quality?.grade ?? null;
  const finalAttempt = result?.result?.finalAttempt ?? null;
  const durationMs = result?.durationMs ?? null;
  const verifyPassed = !!result?.result?.final?.verify?.ok;
  const filesTouchedCount = result?.result?.final?.filesTouched?.length ?? 0;
  const diffPreview = truncate(result?.result?.final?.diff || "", 4000);
  const normalizedMode = mode === "patch" ? "PATCH" : "REVIEW";

  const attempt = await prisma.labAttempt.create({
    data: {
      userId,
      labId,
      mode: normalizedMode,
      success,
      score,
      grade,
      finalAttempt,
      durationMs,
      aiUsed: true,
      reviewUsed: mode === "review",
      patchUsed: mode === "patch",
      verifyPassed,
      filesTouchedCount,
      diffPreview,
    },
  });

  const existing = await prisma.labProgress.findUnique({
    where: {
      userId_labId: {
        userId,
        labId,
      },
    },
  });

  const bestScore =
    existing?.bestScore == null
      ? score
      : score == null
        ? existing.bestScore
        : Math.max(existing.bestScore, score);

  const bestGrade =
    score != null && bestScore === score
      ? grade
      : existing?.bestGrade ?? grade ?? null;

  await prisma.labProgress.upsert({
    where: {
      userId_labId: {
        userId,
        labId,
      },
    },
    create: {
      userId,
      labId,
      startedAt: new Date(),
      lastPlayedAt: new Date(),
      completedAt: success ? new Date() : null,
      bestScore: score,
      bestGrade: grade,
      attemptsCount: 1,
      successCount: success ? 1 : 0,
      aiUsageCount: 1,
      reviewUsageCount: mode === "review" ? 1 : 0,
      patchUsageCount: mode === "patch" ? 1 : 0,
      lastStatus: success ? "COMPLETED" : "IN_PROGRESS",
      lastDurationMs: durationMs,
    },
    update: {
      lastPlayedAt: new Date(),
      completedAt: success ? new Date() : existing?.completedAt,
      bestScore,
      bestGrade,
      attemptsCount: { increment: 1 },
      successCount: success ? { increment: 1 } : undefined,
      aiUsageCount: { increment: 1 },
      reviewUsageCount: mode === "review" ? { increment: 1 } : undefined,
      patchUsageCount: mode === "patch" ? { increment: 1 } : undefined,
      lastStatus: success ? "COMPLETED" : "IN_PROGRESS",
      lastDurationMs: durationMs,
    },
  });

  if (success && score != null && verifyPassed) {
    await prisma.leaderboardEntry.upsert({
      where: {
        userId_labId: {
          userId,
          labId,
        },
      },
      create: {
        userId,
        labId,
        score,
        grade,
        durationMs,
        attemptsCount: finalAttempt ?? 1,
        verifyPassed,
      },
      update: {
        score,
        grade,
        durationMs,
        attemptsCount: finalAttempt ?? 1,
        verifyPassed,
      },
    });
  }

  return attempt;
}

export async function getUserLabProgress(userId) {
  if (!userId) throw new Error("userId is required");

  return prisma.labProgress.findMany({
    where: { userId },
    orderBy: { lastPlayedAt: "desc" },
  });
}

export async function getUserLabAttempts(userId, labId) {
  if (!userId) throw new Error("userId is required");
  if (!labId) throw new Error("labId is required");

  return prisma.labAttempt.findMany({
    where: { userId, labId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

function truncate(text, max) {
  const value = String(text || "");
  return value.length > max ? value.slice(0, max) : value;
}

export const _test = { truncate };

export default {
  getUserLabAttempts,
  getUserLabProgress,
  recordLabAttempt,
};
