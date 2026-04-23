import WebSocket from 'ws'
import Redis from 'ioredis'

const redis = new Redis()

export function createResilientWS(server) {
  const wss = new WebSocket.Server({ server })

  wss.on('connection', async (ws, req) => {
    const sessionId = new URL(req.url, 'http://localhost').searchParams.get('sessionId')

    ws.isAlive = true

    ws.on('pong', () => {
      ws.isAlive = true
    })

    // restore session
    const containerId = await redis.get(`session:${sessionId}:container`)

    ws.on('message', async (msg) => {
      const data = msg.toString()

      // buffer input
      await redis.rpush(`buffer:${sessionId}`, data)

      // stream to container (placeholder)
      console.log('INPUT', data)
    })

    // heartbeat
    const interval = setInterval(() => {
      if (!ws.isAlive) return ws.terminate()
      ws.isAlive = false
      ws.ping()
    }, 5000)

    ws.on('close', () => {
      clearInterval(interval)
    })
  })
}
