import http from 'http'
import WebSocket, { WebSocketServer } from 'ws'
import pty from 'node-pty'
import Redis from 'ioredis'

const server = http.createServer()
const wss = new WebSocketServer({ server })
const redis = new Redis()

wss.on('connection', (ws, req) => {
  const sessionId = req.url.split('/').pop()

  const shell = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    cwd: process.env.HOME,
    env: process.env
  })

  shell.onData((data) => {
    ws.send(JSON.stringify({ type: 'pty', data }))

    redis.xadd('stream:commands', '*', 'session', sessionId, 'output', data)
  })

  ws.on('message', (msg) => {
    const parsed = JSON.parse(msg)

    if (parsed.type === 'input') {
      shell.write(parsed.data)

      redis.xadd('stream:commands', '*', 'session', sessionId, 'input', parsed.data)
    }

    if (parsed.type === 'resize') {
      shell.resize(parsed.cols, parsed.rows)
    }
  })

  ws.on('close', () => {
    shell.kill()
  })
})

server.listen(3000, () => {
  console.log('PTY server running on 3000')
})
