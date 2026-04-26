import http from 'http'
import { spawn } from 'child_process'
import WebSocket, { WebSocketServer } from 'ws'
import Redis from 'ioredis'
import { getContainerId, getLabSlug, switchLab, verifyLab } from './docker-adapter.js'
import { analyzeMentor } from './ai-mentor.js'

const server = http.createServer()
const wss = new WebSocketServer({ server })
const redis = new Redis()

const LAB_SEQUENCE = [
  'nginx-port-conflict',
  'disk-full',
  'permission-denied',
  'memory-leak',
  'db-dead',
]

// Minimum ms between mentor calls per session (avoid flooding Claude)
const MENTOR_DEBOUNCE_MS = 2500

wss.on('connection', async (ws, req) => {
  const sessionId = req.url.split('/').pop()

  let shell = null
  let stage = 0
  let lastCommand = ''
  let outputBuffer = ''
  let mentorTimer = null
  let resolved = false

  // --- spawn PTY via docker exec ---
  async function spawnShell() {
    const containerId = await getContainerId(sessionId)
    if (!containerId) {
      ws.send(JSON.stringify({ type: 'pty', data: '\r\n[SYSTEM] container not ready\r\n' }))
      return
    }

    shell = spawn('docker', ['exec', '-it', containerId, 'bash'], {
      env: { ...process.env, TERM: 'xterm-color' },
    })

    shell.stdout.on('data', (chunk) => onPtyData(chunk.toString()))
    shell.stderr.on('data', (chunk) => onPtyData(chunk.toString()))
    shell.on('close', () => {
      if (!resolved) ws.send(JSON.stringify({ type: 'pty', data: '\r\n[SYSTEM] shell closed\r\n' }))
    })
  }

  function onPtyData(data) {
    ws.send(JSON.stringify({ type: 'pty', data }))
    outputBuffer += data

    // Keep last 1200 chars to give Claude context without token bloat
    if (outputBuffer.length > 1200) outputBuffer = outputBuffer.slice(-1200)

    scheduleMentorCheck()
  }

  function scheduleMentorCheck() {
    if (resolved) return
    clearTimeout(mentorTimer)
    mentorTimer = setTimeout(runMentorCheck, MENTOR_DEBOUNCE_MS)
  }

  async function runMentorCheck() {
    if (resolved) return

    // 1. Run verify.sh — source of truth for all labs (including silent 4-5)
    const isFixed = await verifyLab(sessionId)
    if (isFixed) {
      return emitResolved()
    }

    // 2. Mentor feedback — only for labs 0-2
    const reply = await analyzeMentor({
      stage,
      labSlug: LAB_SEQUENCE[stage],
      operatorLevel: await redis.get(`session:${sessionId}:level`) || '?',
      command: lastCommand,
      output: outputBuffer,
    })

    if (!reply) return

    if (reply === 'INCIDENT_RESOLVED') {
      return emitResolved()
    }

    // Write mentor line into the terminal stream
    ws.send(JSON.stringify({ type: 'pty', data: `\r\n${reply}\r\n` }))
  }

  async function emitResolved() {
    if (resolved) return
    resolved = true
    clearTimeout(mentorTimer)
    outputBuffer = ''

    ws.send(JSON.stringify({ type: 'pty', data: '\r\nINCIDENT_RESOLVED\r\n' }))

    stage++
    if (stage >= LAB_SEQUENCE.length) {
      ws.send(JSON.stringify({ type: 'sequence-complete' }))
      return
    }

    // Switch to next lab
    const newSlug = LAB_SEQUENCE[stage]
    ws.send(JSON.stringify({ type: 'lab-switching', labSlug: newSlug }))

    await switchLab(sessionId, newSlug)
    resolved = false

    if (shell) { shell.kill(); shell = null }
    await spawnShell()

    ws.send(JSON.stringify({ type: 'lab-switched', labSlug: newSlug, stage }))
  }

  // --- incoming WS messages ---
  ws.on('message', async (raw) => {
    let parsed
    try { parsed = JSON.parse(raw) } catch { return }

    if (parsed.type === 'input') {
      lastCommand = parsed.data.trim()
      shell?.stdin?.write(parsed.data)
      redis.xadd('stream:commands', '*', 'session', sessionId, 'input', parsed.data)
    }

    if (parsed.type === 'resize' && shell) {
      // node-pty resize not available via plain spawn — skip for now
    }

    // Manual switch-lab (from frontend escalation logic as fallback)
    if (parsed.type === 'switch-lab') {
      const targetSlug = parsed.labSlug
      const targetStage = LAB_SEQUENCE.indexOf(targetSlug)
      if (targetStage === -1) return

      stage = targetStage
      resolved = false
      if (shell) { shell.kill(); shell = null }

      await switchLab(sessionId, targetSlug)
      await spawnShell()

      ws.send(JSON.stringify({ type: 'lab-switched', labSlug: targetSlug, stage }))
    }

    // Set operator level (sent from DispatcherTerminal after user types 1-5)
    if (parsed.type === 'set-level') {
      await redis.set(`session:${sessionId}:level`, String(parsed.level), 'EX', 3600)
    }
  })

  ws.on('close', () => {
    clearTimeout(mentorTimer)
    shell?.kill()
  })

  // Boot
  await spawnShell()
})

server.listen(process.env.PTY_PORT || 3001, () => {
  console.log(`PTY server running on port ${process.env.PTY_PORT || 3001}`)
})
