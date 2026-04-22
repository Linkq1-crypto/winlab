import { useEffect, useRef } from "react"
import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import "xterm/css/xterm.css"

export default function TerminalV2({ sessionId }) {
  const termRef = useRef(null)
  const term = useRef(null)
  const ws = useRef(null)
  const fit = useRef(null)

  useEffect(() => {
    term.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: "#0b0f14",
        foreground: "#e6edf3"
      }
    })

    fit.current = new FitAddon()
    term.current.loadAddon(fit.current)

    term.current.open(termRef.current)
    fit.current.fit()

    connect()

    term.current.onData((data) => {
      ws.current.send(JSON.stringify({ type: "input", data }))
    })

    function connect() {
      ws.current = new WebSocket(`ws://localhost:3000/ws/${sessionId}`)

      ws.current.onmessage = (event) => {
        const msg = JSON.parse(event.data)

        if (msg.type === "pty") {
          writeSlow(msg.data)
        }

        if (msg.type === "hint") {
          showHint(msg.message)
        }
      }

      ws.current.onclose = () => {
        setTimeout(connect, 1000)
      }
    }

    function writeSlow(text) {
      let i = 0
      function type() {
        if (i < text.length) {
          term.current.write(text[i])
          i++
          setTimeout(type, 5 + Math.random() * 10)
        }
      }
      type()
    }

    function showHint(message) {
      const hint = `\r\n\x1b[90m[hint] ${message}\x1b[0m\r\n`
      term.current.write(hint)
    }

    return () => {
      ws.current.close()
      term.current.dispose()
    }
  }, [])

  return <div ref={termRef} style={{ width: "100%", height: "100%" }} />
}
