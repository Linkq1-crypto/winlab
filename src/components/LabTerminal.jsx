// src/components/LabTerminal.jsx
import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';

export default function LabTerminal({ containerName, onClose, onComplete }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#0a0a0a',
        foreground: '#e5e5e5',
        cursor: '#ef4444',
        selectionBackground: '#ef444440',
      },
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      lineHeight: 1.4,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;

    const wsUrl = `/ws/lab?container=${encodeURIComponent(containerName)}`;
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
          onComplete?.();
        }
        if (msg.type === 'error') term.write(`\r\n\x1b[31m[ERROR]\x1b[0m ${msg.data}\r\n`);
      } catch {}
    };

    ws.onerror = () => term.write('\r\n\x1b[31m[WINLAB]\x1b[0m Connection error.\r\n');

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
  }, [containerName]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">
            Lab Terminal — {containerName}
          </span>
        </div>
        <button
          onClick={() => {
            wsRef.current?.close();
            onClose?.();
          }}
          className="text-[10px] font-mono text-gray-600 hover:text-red-500 uppercase tracking-widest transition-colors"
        >
          [ Termina sessione ]
        </button>
      </div>
      <div ref={containerRef} className="flex-1 p-2 overflow-hidden" />
    </div>
  );
}
