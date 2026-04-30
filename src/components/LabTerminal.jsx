import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import './LabTerminal.css';

function createSocketUrl(containerName, levelId, hintEnabled) {
  const search = new URLSearchParams({
    container: containerName,
    level: levelId,
    hintEnabled: hintEnabled ? 'true' : 'false',
  });
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/lab?${search.toString()}`;
}

function getTerminalFontSize() {
  if (typeof window === 'undefined') return 14;
  if (window.innerWidth <= 390) return 12;
  if (window.innerWidth <= 768) return 13;
  return 14;
}

function debounceFrame(callback, delay = 80) {
  let timeoutId = null;
  let frameId = null;

  return () => {
    if (timeoutId) window.clearTimeout(timeoutId);
    if (frameId) window.cancelAnimationFrame(frameId);
    timeoutId = window.setTimeout(() => {
      frameId = window.requestAnimationFrame(() => {
        timeoutId = null;
        frameId = null;
        callback();
      });
    }, delay);
  };
}

export default function LabTerminal({
  containerName,
  levelId = 'JUNIOR',
  hintEnabled = true,
  onClose,
  onComplete,
}) {
  const wrapperRef = useRef(null);
  const viewportRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const pendingOutputRef = useRef([]);
  const readyRef = useRef(false);
  const resizeObserverRef = useRef(null);
  const debouncedFitRef = useRef(null);
  const [hasOutput, setHasOutput] = useState(false);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  const onCloseRef = useRef(onClose);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    setHasOutput(false);
    readyRef.current = false;
    pendingOutputRef.current = [];

    const term = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: getTerminalFontSize(),
      letterSpacing: 0,
      lineHeight: 1.35,
      scrollback: 1500,
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
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(viewport);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const fitTerminal = () => {
      const currentViewport = viewportRef.current;
      const currentTerm = termRef.current;
      const currentFit = fitAddonRef.current;
      if (!currentViewport || !currentTerm || !currentFit) return;

      const { width, height } = currentViewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      const nextFontSize = getTerminalFontSize();
      if (currentTerm.options.fontSize !== nextFontSize) {
        currentTerm.options.fontSize = nextFontSize;
      }

      currentFit.fit();
      currentTerm.focus();
    };

    const writeChunk = (chunk) => {
      const text = String(chunk || '');
      if (!text) return;
      setHasOutput(true);
      if (!readyRef.current || !termRef.current) {
        pendingOutputRef.current.push(text);
        return;
      }
      termRef.current.write(text);
    };

    const flushPending = () => {
      if (!readyRef.current || !termRef.current || pendingOutputRef.current.length === 0) return;
      termRef.current.write(pendingOutputRef.current.join(''));
      pendingOutputRef.current = [];
    };

    debouncedFitRef.current = debounceFrame(() => {
      fitTerminal();
      flushPending();
    });

    requestAnimationFrame(() => {
      fitTerminal();
      readyRef.current = true;
      flushPending();
      writeChunk('\r\n\x1b[36m[WINLAB]\x1b[0m Connecting to lab shell...\r\n');
    });

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        debouncedFitRef.current?.();
      }).catch(() => {});
    }

    const handleResize = () => {
      debouncedFitRef.current?.();
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    const observer = new ResizeObserver(() => {
      debouncedFitRef.current?.();
    });
    observer.observe(viewport);
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    resizeObserverRef.current = observer;

    const ws = new WebSocket(createSocketUrl(containerName, levelId, hintEnabled));
    socketRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'ready') {
          writeChunk('\r\n\x1b[32m[WINLAB]\x1b[0m Lab ready. Type commands below.\r\n\r\n');
          return;
        }
        if (message.type === 'output') {
          writeChunk(message.data);
          return;
        }
        if (message.type === 'exit') {
          writeChunk('\r\n\x1b[33m[WINLAB]\x1b[0m Session ended.\r\n');
          onCompleteRef.current?.();
          return;
        }
        if (message.type === 'error') {
          writeChunk(`\r\n\x1b[31m[ERROR]\x1b[0m ${message.data}\r\n`);
        }
      } catch {
        writeChunk(String(event.data || ''));
      }
    };

    ws.onerror = () => {
      writeChunk('\r\n\x1b[31m[WINLAB]\x1b[0m Connection error.\r\n');
    };

    ws.onclose = (event) => {
      if (!event.wasClean) {
        writeChunk('\r\n\x1b[31m[WINLAB]\x1b[0m Connection lost.\r\n');
      }
    };

    const inputDisposable = term.onData((data) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    return () => {
      inputDisposable.dispose();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      socketRef.current?.close();
      socketRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      readyRef.current = false;
      pendingOutputRef.current = [];
    };
  }, [containerName, hintEnabled, levelId]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-[linear-gradient(180deg,#081019_0%,#05070c_100%)] text-slate-200">
      <div className="shrink-0 border-b border-cyan-400/10 bg-black/20 px-4 py-3 backdrop-blur-sm sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-cyan-200/80">
                Live Incident Terminal
              </div>
              <div className="mt-1 truncate text-xs font-mono text-slate-400">
                {containerName}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              socketRef.current?.close();
              onCloseRef.current?.();
            }}
            className="w-full rounded-full border border-rose-400/20 bg-rose-400/10 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.25em] text-rose-200 transition-colors hover:bg-rose-400/20 sm:w-auto"
          >
            End Session
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-hidden p-3 sm:p-4 md:p-5">
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-cyan-400/12 bg-[#07111a] shadow-[0_0_60px_rgba(14,165,233,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 px-4 py-2 text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500">
            <span>shell attached</span>
            <span>network isolated</span>
          </div>
          {isOffline ? (
            <div className="shrink-0 border-b border-amber-400/10 bg-amber-400/10 px-4 py-2 text-xs text-amber-100">
              Connection lost. Reconnect to continue this incident.
            </div>
          ) : null}

          <div
            ref={wrapperRef}
            className="relative min-h-0 min-w-0 flex-1 overflow-hidden"
            style={{ height: 'min(70dvh, 620px)' }}
          >
            <div
              ref={viewportRef}
              className="winlab-xterm-shell absolute inset-0 h-full w-full min-h-0 min-w-0 overflow-hidden px-3 py-3"
            />
            {!hasOutput && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-xs font-mono uppercase tracking-[0.24em] text-slate-500">
                awaiting terminal stream
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
