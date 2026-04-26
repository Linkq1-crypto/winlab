import { exec } from 'child_process'
import { promisify } from 'util'
import Docker from 'dockerode'
import Redis from 'ioredis'

const docker = new Docker()
const redis = new Redis()
const execAsync = promisify(exec)

// Lab image mapping — falls back to winlab-base if no dedicated image exists
const LAB_IMAGE = (labSlug) => `winlab-${labSlug}`

export async function createLab(sessionId, labSlug = 'nginx-port-conflict') {
  const image = LAB_IMAGE(labSlug)

  const container = await docker.createContainer({
    Image: image,
    Tty: true,
    Cmd: ['/bin/bash'],
    OpenStdin: true,
    StdinOnce: false,
    Env: [`LAB_ID=${labSlug}`],
  })

  await container.start()

  await redis.set(`session:${sessionId}:container`, container.id, 'EX', 3600)
  await redis.set(`session:${sessionId}:lab`, labSlug, 'EX', 3600)

  return container.id
}

// Returns the container ID for a PTY exec (used by pty-server via docker exec)
export async function getContainerId(sessionId) {
  return redis.get(`session:${sessionId}:container`)
}

export async function getLabSlug(sessionId) {
  return redis.get(`session:${sessionId}:lab`)
}

export async function attachLab(sessionId) {
  const containerId = await redis.get(`session:${sessionId}:container`)
  const container = docker.getContainer(containerId)

  const stream = await container.attach({
    stream: true,
    stdin: true,
    stdout: true,
    stderr: true,
  })

  return stream
}

// Run verify.sh inside the container and return true if VERIFY_OK
export async function verifyLab(sessionId) {
  const containerId = await redis.get(`session:${sessionId}:container`)
  const labSlug = await redis.get(`session:${sessionId}:lab`)
  if (!containerId || !labSlug) return false

  try {
    const { stdout } = await execAsync(
      `docker exec ${containerId} bash /labs/${labSlug}/verify.sh`,
      { timeout: 8000 }
    )
    return stdout.includes('VERIFY_OK')
  } catch {
    return false
  }
}

// Destroy current container and spin up the next lab for the same session
export async function switchLab(sessionId, newLabSlug) {
  await destroyLab(sessionId)
  const containerId = await createLab(sessionId, newLabSlug)
  return containerId
}

export async function destroyLab(sessionId) {
  const containerId = await redis.get(`session:${sessionId}:container`)
  if (!containerId) return

  const container = docker.getContainer(containerId)
  await container.kill().catch(() => {})
  await container.remove().catch(() => {})

  await redis.del(`session:${sessionId}:container`)
  await redis.del(`session:${sessionId}:lab`)
}
