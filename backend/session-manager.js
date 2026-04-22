import Redis from 'ioredis'
import { createLab, destroyLab } from './docker-adapter.js'

const redis = new Redis()

export async function startSession(userId) {
  const sessionId = `sess:${userId}:${Date.now()}`

  await createLab(sessionId)

  await redis.set(`session:${sessionId}:user`, userId, 'EX', 3600)

  return sessionId
}

export async function endSession(sessionId) {
  await destroyLab(sessionId)
  await redis.del(`session:${sessionId}:user`)
}

export async function validateSession(sessionId, userId) {
  const stored = await redis.get(`session:${sessionId}:user`)
  return stored === userId
}
