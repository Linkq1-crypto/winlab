import { useEffect, useRef } from "react"
import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import "xterm/css/xterm.css"

export default function LabTerminal({ sessionId }) {
  const terminalRef = useRef(null)
  const term = useRef(null)
  const ws = useRef(null)
  const fitAddon = useRef(null)

  useEffect(() => {
    term.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: "#0b0f14",
        foreground: "#e6edf3"
      }
    })

    fitAddon.current = new FitAddon()
    term.current.loadAddon(fitAddon.current)

    term.current.open(terminalRef.current)
    fitAddon.current.fit()

    ws.current = new WebSocket(`ws://localhost:3000/ws/${sessionId}`)

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data)

      if (msg.type === "pty") {
        term.current.write(msg.data)
      }

      if (msg.type === "hint") {
        term.current.write(`\r\n\x1b[90m[hint] ${msg.message}\x1b[0m\r\n`)
      }
    }

    term.current.onData((data) => {
      ws.current.send(JSON.stringify({ type: "input", data }))
    })

    window.addEventListener("resize", () => {
      fitAddon.current.fit()
      ws.current.send(JSON.stringify({
        type: "resize",
        cols: term.current.cols,
        rows: term.current.rows
      }))
    })

    return () => {
      ws.current.close()
      term.current.dispose()
    }
  }, [])

  return <div ref={terminalRef} style={{ width: "100%", height: "100%" }} />
}
