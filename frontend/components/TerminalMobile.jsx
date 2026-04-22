import { useEffect, useRef } from "react"
import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"

export default function TerminalMobile({ sessionId }) {
  const ref = useRef(null)
  const term = useRef(null)
  const ws = useRef(null)
  const fit = useRef(null)

  useEffect(() => {
    term.current = new Terminal({
      cursorBlink: true,
      fontSize: 12
    })

    fit.current = new FitAddon()
    term.current.loadAddon(fit.current)

    term.current.open(ref.current)
    fit.current.fit()

    connect()

    function connect() {
      ws.current = new WebSocket(`ws://localhost:3000?sessionId=${sessionId}`)

      ws.current.onmessage = (e) => {
        const msg = JSON.parse(e.data)

        if (msg.type === "pty") {
          term.current.write(msg.data)
        }
      }

      ws.current.onclose = () => {
        setTimeout(connect, 1000)
      }
    }

    term.current.onData((data) => {
      // optimistic UI
      term.current.write(data)

      ws.current.send(JSON.stringify({ type: "input", data }))
    })

    return () => {
      ws.current.close()
      term.current.dispose()
    }
  }, [])

  return <div ref={ref} style={{ width: "100%", height: "100%" }} />
}
