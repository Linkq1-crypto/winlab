import Docker from 'dockerode'

const docker = new Docker()

export async function createSecureContainer(sessionId) {
  const container = await docker.createContainer({
    Image: 'ubuntu',
    Tty: true,
    Cmd: ['/bin/bash'],
    OpenStdin: true,
    HostConfig: {
      Memory: 256 * 1024 * 1024,
      NanoCpus: 500000000,
      PidsLimit: 64,
      NetworkMode: 'none',
      ReadonlyRootfs: false,
      AutoRemove: true
    }
  })

  await container.start()
  return container.id
}
