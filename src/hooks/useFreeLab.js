import { useState, useEffect, useCallback, useRef } from "react";

const SESSION_KEY = "winlab_free_session";

function getOrCreateSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID 
         ? crypto.randomUUID() 
         : Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Manages an anonymous Docker lab session for the free-lab homepage experience.
 *
 * Returns:
 *   started      – container is up and accepting commands
 *   booting      – container is starting up
 *   lines        – array of { text, type } terminal output lines
 *   commandCount – number of commands the user has run
 *   sessionId    – the anonymous session UUID
 *   sendCommand(cmd) – run a shell command in the container
 *   verify()         – run the lab's verify.sh and return { ok, output }
 */
export function useFreeLab(labId) {
  const [started, setStarted]           = useState(false);
  const [booting, setBooting]           = useState(false);
  const [lines, setLines]               = useState([]);
  const [commandCount, setCommandCount] = useState(0);
  const sessionId                       = useRef(null);
  const mountedRef                      = useRef(true);

  const addLine = useCallback((text, type = "output") => {
    setLines(prev => [...prev, { text, type }]);
  }, []);

  const bootSequence = useCallback(async (sid) => {
    setBooting(true);
    setLines([]);
    addLine("Connecting to lab environment…", "system");

    // Reconnect to an existing container (user refreshed mid-session)
    try {
      const ping = await fetch("/api/lab/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, command: "echo alive" }),
      });
      if (ping.ok) {
        const pingData = await ping.json();
        if (pingData.ok) {
          if (!mountedRef.current) return;
          setBooting(false);
          setStarted(true);
          addLine("Session restored.", "system");
          return;
        }
      }
    } catch { /* container not running — fall through to full boot */ }

    const bootLogs = [
      "Starting container…",
      "Loading nginx configuration…",
      "Injecting lab scenario…",
      "Ready.",
    ];

    // Start ticking fake boot logs before the real request so they
    // appear during the wait, not after it.
    let logIdx = 0;
    const logTimer = setInterval(() => {
      if (logIdx < bootLogs.length && mountedRef.current) {
        addLine(bootLogs[logIdx++], "system");
      }
    }, 600);

    let res;
    try {
      res = await fetch("/api/lab/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, sessionId: sid }),
      });
    } catch {
      clearInterval(logTimer);
      addLine("Failed to reach the server. Please refresh.", "error");
      setBooting(false);
      return;
    }

    clearInterval(logTimer);
    // Flush any remaining boot log lines
    while (logIdx < bootLogs.length) addLine(bootLogs[logIdx++], "system");

    if (!mountedRef.current) return;

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      addLine(`Error: ${body.error || res.statusText}`, "error");
      setBooting(false);
      return;
    }

    setBooting(false);
    setStarted(true);
    addLine("Lab environment ready. Type a command to start.", "system");
  }, [labId, addLine]);

  // Start on mount
  useEffect(() => {
    mountedRef.current = true;
    sessionId.current = getOrCreateSessionId();
    bootSequence(sessionId.current);

    const handleUnload = () => {
      navigator.sendBeacon("/api/lab/stop", JSON.stringify({ sessionId: sessionId.current }));
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("beforeunload", handleUnload);
      fetch("/api/lab/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current }),
        keepalive: true,
      }).catch(() => {});
    };
  }, [bootSequence]);

  const sendCommand = useCallback(async (cmd) => {
    if (!cmd.trim() || !started) return;

    addLine(`$ ${cmd}`, "input");
    setCommandCount(c => c + 1);

    const res = await fetch("/api/lab/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId.current, command: cmd }),
    });

    const data = await res.json().catch(() => ({ ok: false, output: "Error parsing response" }));

    if (data.ok) {
      if (data.output) addLine(data.output, data.exitCode === 0 ? "output" : "error");
    } else {
      addLine(data.error || "Command failed", "error");
    }
  }, [started, addLine]);

  const verify = useCallback(async () => {
    const res = await fetch("/api/lab/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labId, sessionId: sessionId.current }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    return data;
  }, [labId]);

  return { started, booting, lines, commandCount, sessionId: sessionId.current, addLine, sendCommand, verify };
}
