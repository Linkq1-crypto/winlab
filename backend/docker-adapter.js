import Docker from 'dockerode'
import Redis from 'ioredis'

const docker = new Docker()
const redis = new Redis()

export async function createLab(sessionId) {
  const container = await docker.createContainer({
    Image: 'ubuntu',
    Tty: true,
    Cmd: ['/bin/bash'],
    OpenStdin: true,
    StdinOnce: false
  })

  await container.start()

  await redis.set(`session:${sessionId}:container`, container.id, 'EX', 3600)

  return container.id
}

export async function attachLab(sessionId) {
  const containerId = await redis.get(`session:${sessionId}:container`)
  const container = docker.getContainer(containerId)

  const stream = await container.attach({
    stream: true,
    stdin: true,
    stdout: true,
    stderr: true
  })

  return stream
}

export async function destroyLab(sessionId) {
  const containerId = await redis.get(`session:${sessionId}:container`)
  if (!containerId) return

  const container = docker.getContainer(containerId)
  await container.kill().catch(() => {})
  await container.remove().catch(() => {})

  await redis.del(`session:${sessionId}:container`)
}
