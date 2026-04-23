import { getIncidentChain } from "../config/incidentChains.js";

export function createIncidentChainSession(chainId, { seed = null } = {}) {
  const chain = getIncidentChain(chainId);
  if (!chain) throw new Error(`Unknown chainId: ${chainId}`);

  return {
    chainId: chain.id,
    title: chain.title,
    difficulty: chain.difficulty,
    seed: seed || `${chain.id}:${Date.now()}`,
    currentStepIndex: 0,
    steps: chain.steps.map((step, index) => ({
      ...step,
      index,
      status: "pending",
      startedAt: null,
      completedAt: null,
      attempts: 0,
      usedAI: false,
    })),
    completed: false,
    finalMessage: chain.finalMessage,
    startedAt: new Date().toISOString(),
    completedAt: null,
  };
}

export function getCurrentChainStep(session) {
  return session?.steps?.[session.currentStepIndex] || null;
}

export function startCurrentStep(session) {
  const step = getCurrentChainStep(session);
  if (!step) return session;

  if (!step.startedAt) {
    step.startedAt = new Date().toISOString();
    step.status = "in_progress";
  }

  return session;
}

export function markCurrentStepAttempt(session, { usedAI = false } = {}) {
  const step = getCurrentChainStep(session);
  if (!step) return session;

  step.attempts += 1;
  step.usedAI = step.usedAI || usedAI;
  return session;
}

export function completeCurrentStep(session) {
  const step = getCurrentChainStep(session);
  if (!step) return session;

  step.status = "completed";
  step.completedAt = new Date().toISOString();
  session.currentStepIndex += 1;

  if (session.currentStepIndex >= session.steps.length) {
    session.completed = true;
    session.completedAt = new Date().toISOString();
  } else {
    startCurrentStep(session);
  }

  return session;
}

export function failCurrentStep(session) {
  const step = getCurrentChainStep(session);
  if (!step) return session;

  step.status = "failed";
  return session;
}

export default {
  completeCurrentStep,
  createIncidentChainSession,
  failCurrentStep,
  getCurrentChainStep,
  markCurrentStepAttempt,
  startCurrentStep,
};
