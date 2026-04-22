// REDIS LAYER - persistence + scaling ready
// plug this into core-secure-layer replacing in-memory Map

import Redis from "ioredis"

const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379")

const PREFIX = "container:"

export async function registerContainer(containerId, userId, ttl = 3600) {
  const key = PREFIX + containerId

  await redis.set(
    key,
    JSON.stringify({ userId, createdAt: Date.now() }),
    "EX",
    ttl
  )
}

export async function getContainer(containerId) {
  const data = await redis.get(PREFIX + containerId)
  return data ? JSON.parse(data) : null
}

export async function verifyAccess(tokenData, containerId) {
  const meta = await getContainer(containerId)

  if (!meta) return false
  if (meta.userId !== tokenData.id) return false

  return true
}

export async function destroyContainer(containerId) {
  await redis.del(PREFIX + containerId)
}

export default redis
