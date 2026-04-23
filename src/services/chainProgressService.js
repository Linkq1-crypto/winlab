import prisma from "../lib/prisma.js";
import { scoreChain } from "./chainScoring.js";

export async function recordChainAttempt({
  userId,
  session,
  durationMs = null,
}) {
  if (!userId) throw new Error("userId is required");
  if (!session?.chainId) throw new Error("session.chainId is required");

  const totalSteps = session.steps?.length || 0;
  const completedSteps = (session.steps || []).filter((step) => step.status === "completed").length;
  const retries = (session.steps || []).reduce((sum, step) => (
    sum + Math.max(0, (step.attempts || 0) - 1)
  ), 0);
  const aiUsed = (session.steps || []).some((step) => step.usedAI);
  const success = !!session.completed;
  const quality = scoreChain({
    totalSteps,
    completedSteps,
    totalDurationMs: durationMs || durationFromSession(session),
    usedAI: aiUsed,
    retries,
  });

  const attempt = await prisma.chainAttempt.create({
    data: {
      userId,
      chainId: session.chainId,
      success,
      score: quality.score,
      grade: quality.grade,
      totalSteps,
      completedSteps,
      durationMs: durationMs || durationFromSession(session),
      aiUsed,
      retries,
      seed: session.seed || null,
      summary: truncate(JSON.stringify(session.steps || []), 4000),
    },
  });

  const existing = await prisma.chainProgress.findUnique({
    where: {
      userId_chainId: {
        userId,
        chainId: session.chainId,
      },
    },
  });

  const bestScore = existing?.bestScore == null
    ? quality.score
    : Math.max(existing.bestScore, quality.score);
  const bestGrade = bestScore === quality.score
    ? quality.grade
    : existing?.bestGrade ?? quality.grade;

  await prisma.chainProgress.upsert({
    where: {
      userId_chainId: {
        userId,
        chainId: session.chainId,
      },
    },
    create: {
      userId,
      chainId: session.chainId,
      completedAt: success ? new Date() : null,
      bestScore: quality.score,
      bestGrade: quality.grade,
      attemptsCount: 1,
      successCount: success ? 1 : 0,
      lastStatus: success ? "COMPLETED" : "IN_PROGRESS",
      lastDurationMs: durationMs || durationFromSession(session),
      lastSeed: session.seed || null,
    },
    update: {
      lastPlayedAt: new Date(),
      completedAt: success ? new Date() : existing?.completedAt,
      bestScore,
      bestGrade,
      attemptsCount: { increment: 1 },
      successCount: success ? { increment: 1 } : undefined,
      lastStatus: success ? "COMPLETED" : "IN_PROGRESS",
      lastDurationMs: durationMs || durationFromSession(session),
      lastSeed: session.seed || null,
    },
  });

  return attempt;
}

export async function getUserChainProgress(userId) {
  if (!userId) throw new Error("userId is required");

  return prisma.chainProgress.findMany({
    where: { userId },
    orderBy: { lastPlayedAt: "desc" },
  });
}

function durationFromSession(session) {
  const start = Date.parse(session.startedAt || "");
  const end = Date.parse(session.completedAt || "") || Date.now();
  if (!Number.isFinite(start)) return null;
  return Math.max(0, end - start);
}

function truncate(text, max) {
  const value = String(text || "");
  return value.length > max ? value.slice(0, max) : value;
}

export const _test = { durationFromSession, truncate };

export default { getUserChainProgress, recordChainAttempt };
