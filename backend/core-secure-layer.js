// CORE SECURE LAYER (drop-in integration)
// Handles: auth binding, container ownership, AI observer hook, paywall

import jwt from "jsonwebtoken"

export const containers = new Map()

export function registerContainer(containerId, userId) {
  containers.set(containerId, {
    userId,
    createdAt: Date.now()
  })
}

export function verifyAccess(token, containerId, SECRET) {
  try {
    const decoded = jwt.verify(token, SECRET)
    const meta = containers.get(containerId)

    if (!meta) return false
    if (meta.userId !== decoded.id) return false

    return decoded
  } catch (e) {
    return false
  }
}

export function paywall(user) {
  if (!user.plan && !user.freeUsed) {
    user.freeUsed = true
    return true
  }

  if (!user.plan) {
    return false
  }

  return true
}

// AI OBSERVER (async, non-blocking)
export async function observeCommand({ cmd, history }) {
  // placeholder for LLM call
  if (cmd.includes("rm -rf")) {
    return "Stai eseguendo una cancellazione distruttiva. Verifica il path o usa opzioni più sicure."
  }

  return null
}
