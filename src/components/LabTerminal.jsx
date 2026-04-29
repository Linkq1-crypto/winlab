// src/components/LabTerminal.jsx
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

export default function LabTerminal({ containerName, levelId = "JUNIOR", hintEnabled = true, onClose, onComplete }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);

  const onCloseRef = useRef(onClose);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#07111a',
        foreground: '#d7e3f1',
        cursor: '#f97316',
        cursorAccent: '#07111a',
        selectionBackground: '#38bdf833',
        black: '#07111a',
        red: '#fb7185',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#38bdf8',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e5eef8',
        brightBlack: '#4b5563',
        brightRed: '#fda4af',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde68a',
        brightBlue: '#7dd3fc',
        brightMagenta: '#d8b4fe',
        brightCyan: '#67e8f9',
        brightWhite: '#f8fafc',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 14,
      lineHeight: 1.5,
      letterSpacing: 0.2,
      scrollback: 1500,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;

    const wsUrl = `/ws/lab?container=${encodeURIComponent(containerName)}&level=${encodeURIComponent(levelId)}&hintEnabled=${hintEnabled ? "true" : "false"}`;
    const ws = new WebSocket(
      window.location.protocol === 'https:'
        ? `wss://${window.location.host}${wsUrl}`
        : `ws://${window.location.host}${wsUrl}`
    );
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'output') term.write(msg.data);
        if (msg.type === 'ready') term.write('\r\n\x1b[32m[WINLAB]\x1b[0m Lab ready. Type commands below.\r\n\r\n');
        if (msg.type === 'exit') {
          term.write('\r\n\x1b[33m[WINLAB]\x1b[0m Session ended.\r\n');
          onCompleteRef.current?.();
        }
        if (msg.type === 'error') term.write(`\r\n\x1b[31m[ERROR]\x1b[0m ${msg.data}\r\n`);
      } catch {}
    };

    ws.onerror = () => term.write('\r\n\x1b[31m[WINLAB]\x1b[0m Connection error.\r\n');

    ws.onclose = (e) => {
      if (!e.wasClean) {
        term.write('\r\n\x1b[31m[WINLAB]\x1b[0m Connection lost.\r\n');
      }
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const observer = new ResizeObserver(() => fitAddon.fit());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      ws.close();
      term.dispose();
    };
  }, [containerName, hintEnabled, levelId]);

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#081019_0%,#05070c_100%)] text-slate-200">
      <div className="flex items-center justify-between border-b border-cyan-400/10 bg-black/20 px-5 py-3 shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-cyan-200/80">
              Live Incident Terminal
            </div>
            <div className="mt-1 text-xs font-mono text-slate-400">
              {containerName}
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            wsRef.current?.close();
            onClose?.();
          }}
          className="rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.25em] text-rose-200 transition-colors hover:bg-rose-400/20"
        >
          Termina sessione
        </button>
      </div>
      <div className="flex-1 overflow-hidden p-3 md:p-5">
        <div className="h-full rounded-[24px] border border-cyan-400/12 bg-[#07111a] shadow-[0_0_60px_rgba(14,165,233,0.08)]">
          <div className="flex items-center justify-between border-b border-white/6 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500">
            <span>shell attached</span>
            <span>network isolated</span>
          </div>
          <div ref={containerRef} className="h-[calc(100%-37px)] overflow-hidden p-3" />
        </div>
      </div>
    </div>
  );
}
