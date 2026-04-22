import Redis from 'ioredis'

const redis = new Redis()

export async function startAIObserver() {
  const GROUP = 'ai-group'
  const STREAM = 'stream:commands'

  try {
    await redis.xgroup('CREATE', STREAM, GROUP, '$', 'MKSTREAM')
  } catch (e) {}

  while (true) {
    const res = await redis.xreadgroup(
      'GROUP', GROUP, 'consumer-1',
      'BLOCK', 5000,
      'COUNT', 10,
      'STREAMS', STREAM, '>'
    )

    if (!res) continue

    for (const [stream, messages] of res) {
      for (const [id, fields] of messages) {
        const data = parse(fields)

        const hint = generateHint(data.input)

        if (hint) {
          await redis.xadd(
            `stream:ai:${data.session}`,
            '*',
            'type', 'hint',
            'message', hint
          )
        }

        await redis.xack(STREAM, GROUP, id)
      }
    }
  }
}

function parse(arr) {
  const obj = {}
  for (let i = 0; i < arr.length; i += 2) {
    obj[arr[i]] = arr[i + 1]
  }
  return obj
}

function generateHint(cmd) {
  if (!cmd) return null

  if (cmd.includes('ls')) return 'Try using -la'
  if (cmd.includes('ssh')) return 'Check known_hosts or keys'

  return null
}
