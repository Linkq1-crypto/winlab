import { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import 'xterm/css/xterm.css';
import './LabTerminal.css';
import { trackEvent } from '../lib/track.js';

function createSocketUrl(containerName, levelId, hintEnabled, sessionId, labId) {
  const search = new URLSearchParams({
    container: containerName,
    level: levelId,
    hintEnabled: hintEnabled ? 'true' : 'false',
  });
  if (sessionId) search.set('sessionId', sessionId);
  if (labId) search.set('labId', labId);
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/lab?${search.toString()}`;
}

function getTerminalFontSize() {
  if (typeof window === 'undefined') return 14;
  if (window.innerWidth <= 430) return 11;
  if (window.innerWidth <= 768) return 13;
  return 14;
}

function getAdaptiveLayoutMetrics() {
  if (typeof window === 'undefined') {
    return {
      width: 1440,
      height: 900,
      shellMinHeight: 0,
      shellPreferredHeight: null,
      panelMaxHeight: null,
      stacked: false,
    };
  }

  const width = window.innerWidth;
  const height = window.innerHeight;

  if (width < 768) {
    return {
      width,
      height,
      shellMinHeight: Math.max(280, Math.min(380, Math.round(height * 0.34))),
      shellPreferredHeight: Math.max(320, Math.min(520, Math.round(height * 0.46))),
      panelMaxHeight: Math.max(260, Math.min(420, Math.round(height * 0.4))),
      stacked: true,
    };
  }

  if (width < 1280) {
    return {
      width,
      height,
      shellMinHeight: Math.max(320, Math.min(440, Math.round(height * 0.38))),
      shellPreferredHeight: Math.max(380, Math.min(640, Math.round(height * 0.52))),
      panelMaxHeight: Math.max(300, Math.min(500, Math.round(height * 0.34))),
      stacked: true,
    };
  }

  return {
    width,
    height,
    shellMinHeight: 0,
    shellPreferredHeight: null,
    panelMaxHeight: null,
    stacked: false,
  };
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

function normalizeIncidentBrief(incidentBrief, fallbackLabId) {
  const brief = incidentBrief && typeof incidentBrief === 'object' ? incidentBrief : {};
  return {
    labId: brief.labId || fallbackLabId || '',
    labTitle: brief.labTitle || '',
    incidentType: brief.incidentType || '',
    symptoms: brief.symptoms || '',
    objective: brief.objective || '',
    successCondition: brief.successCondition || '',
    suggestedCommands: Array.isArray(brief.suggestedCommands) ? brief.suggestedCommands.filter(Boolean) : [],
    hints: Array.isArray(brief.hints) ? brief.hints.filter(Boolean) : [],
    affectedServices: Array.isArray(brief.affectedServices) ? brief.affectedServices.filter(Boolean) : [],
  };
}

const SERVICE_PATTERNS = [
  { label: 'nginx', match: /\bnginx\b/i },
  { label: 'postgresql', match: /\bpostgres|postgresql|db\b/i },
  { label: 'redis', match: /\bredis\b/i },
  { label: 'queue-worker', match: /\bqueue|worker\b/i },
  { label: 'api-gateway', match: /\bapi\b/i },
  { label: 'docker', match: /\bdocker|container\b/i },
  { label: 'auth-service', match: /\bauth|jwt|login\b/i },
  { label: 'storage-volume', match: /\bdisk|filesystem|storage\b/i },
];

function collectIncidentText(brief) {
  return [
    brief?.labId,
    brief?.labTitle,
    brief?.incidentType,
    brief?.symptoms,
    brief?.objective,
    brief?.successCondition,
    ...(brief?.suggestedCommands || []),
    ...(brief?.hints || []),
  ]
    .filter(Boolean)
    .join(' ');
}

function deriveAffectedServices(brief, fallbackLabId) {
  if (Array.isArray(brief?.affectedServices) && brief.affectedServices.length > 0) {
    return Array.from(new Set(brief.affectedServices.map((value) => String(value).trim()).filter(Boolean))).slice(0, 5);
  }
  const haystack = `${collectIncidentText(brief)} ${fallbackLabId || ''}`;
  const services = SERVICE_PATTERNS.filter((item) => item.match.test(haystack)).map((item) => item.label);
  const unique = Array.from(new Set(services));
  return unique.length > 0 ? unique.slice(0, 4) : ['app-service', 'systemd-unit', 'verification-job'];
}

function detectSeverity(brief, fallbackLabId) {
  const haystack = `${collectIncidentText(brief)} ${fallbackLabId || ''}`.toLowerCase();
  if (/\boutage|down|offline|critical|forgery|bypass|deadlock|crash\b/.test(haystack)) return 'SEV-1';
  if (/\bdegraded|latency|timeout|contention|error|permission|lock\b/.test(haystack)) return 'SEV-2';
  return 'SEV-3';
}

function formatElapsed(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getSeverityStyles(severity) {
  if (severity === 'SEV-1') {
    return {
      pill: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
      dot: 'bg-rose-400',
      label: 'critical',
    };
  }
  if (severity === 'SEV-2') {
    return {
      pill: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
      dot: 'bg-amber-300',
      label: 'major',
    };
  }
  return {
    pill: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
    dot: 'bg-sky-300',
    label: 'minor',
  };
}

function buildRecoveryStages(progress) {
  return [
    { label: 'Detection', done: progress >= 15 },
    { label: 'Triage', done: progress >= 35 },
    { label: 'Mitigation', done: progress >= 65 },
    { label: 'Validation', done: progress >= 90 },
  ];
}

function normalizeEventSeverity(cmd) {
  if (/failed|error|disconnected/i.test(cmd)) return 'critical';
  if (/verify_requested|terminal_command|api_command|session_started/i.test(cmd)) return 'high';
  return 'low';
}

function parseSignalPayload(output) {
  try {
    const parsed = JSON.parse(String(output || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function mapSessionEvent(record, startedAtMs) {
  const tsMs = Date.parse(record?.ts || '') || Date.now();
  const atSec = Math.max(0, Math.round((tsMs - startedAtMs) / 1000));
  const output = String(record?.output || '').trim();
  const cmd = String(record?.cmd || '');
  const signal = cmd === '__signal__' ? parseSignalPayload(output) : null;

  if (signal) {
    if (signal.type === 'affected_services_update') {
      return {
        id: record.id,
        atSec,
        kind: 'signal',
        severity: 'low',
        actor: 'topology',
        message: `Affected services updated: ${(signal.services || []).join(', ') || 'unknown'}.`,
        signal,
      };
    }
    if (signal.type === 'service_health') {
      return {
        id: record.id,
        atSec,
        kind: 'signal',
        severity: signal.status === 'healthy' ? 'low' : 'high',
        actor: 'service-health',
        message: `${signal.status === 'healthy' ? 'Healthy' : 'Degraded'}: ${(signal.services || []).join(', ') || 'service'}.`,
        signal,
      };
    }
    if (signal.type === 'phase_update') {
      return {
        id: record.id,
        atSec,
        kind: signal.phase === 'validation' ? 'validation' : signal.phase === 'mitigation' ? 'impact' : 'detection',
        severity: 'low',
        actor: 'orchestrator',
        message: `Recovery phase updated: ${signal.phase}.`,
        signal,
      };
    }
    if (signal.type === 'escalation') {
      return {
        id: record.id,
        atSec,
        kind: 'escalation',
        severity: 'high',
        actor: signal.level || 'on-call',
        message: signal.summary || 'Escalation recorded.',
        signal,
      };
    }
    if (signal.type === 'verification_result') {
      return {
        id: record.id,
        atSec,
        kind: 'validation',
        severity: signal.status === 'passed' ? 'low' : 'critical',
        actor: 'verification',
        message: signal.summary || `Verification ${signal.status || 'completed'}.`,
        signal,
      };
    }
  }

  if (cmd === '__session_started__') {
    return { id: record.id, atSec, kind: 'detection', severity: 'critical', actor: 'scheduler', message: 'Isolated incident session started.' };
  }
  if (cmd === '__terminal_connected__') {
    return { id: record.id, atSec, kind: 'system', severity: 'low', actor: 'terminal', message: 'Interactive shell attached for operator.' };
  }
  if (cmd === '__context__') {
    return { id: record.id, atSec, kind: 'impact', severity: 'high', actor: 'context', message: output || 'Incident context loaded into the terminal.' };
  }
  if (cmd === '__terminal_command__') {
    return { id: record.id, atSec, kind: 'operator', severity: 'medium', actor: 'operator', message: `Command executed: ${output}` };
  }
  if (cmd === '__api_command__') {
    return { id: record.id, atSec, kind: 'operator', severity: 'medium', actor: 'api', message: `API command executed: ${output}` };
  }
  if (cmd === '__verify_requested__') {
    return { id: record.id, atSec, kind: 'validation', severity: 'high', actor: 'verification', message: `Verification started for ${record?.labId || 'session'}.` };
  }
  if (cmd === '__verify_passed__') {
    return { id: record.id, atSec, kind: 'validation', severity: 'low', actor: 'verification', message: output || 'Verification passed.' };
  }
  if (cmd === '__verify_failed__') {
    return { id: record.id, atSec, kind: 'validation', severity: 'critical', actor: 'verification', message: output || 'Verification failed.' };
  }
  if (cmd === '__session_stopped__') {
    return { id: record.id, atSec, kind: 'system', severity: 'low', actor: 'operator', message: output || 'Session stopped by operator.' };
  }
  if (cmd === '__terminal_disconnected__') {
    return { id: record.id, atSec, kind: 'system', severity: 'low', actor: 'terminal', message: 'Interactive shell disconnected.' };
  }
  if (cmd === '__api_output__') {
    return { id: record.id, atSec, kind: 'signal', severity: normalizeEventSeverity(cmd), actor: 'service', message: output || 'Command output captured.' };
  }
  return { id: record.id, atSec, kind: 'signal', severity: normalizeEventSeverity(cmd), actor: 'system', message: output || cmd || 'Session event recorded.' };
}

function deriveProgressFromEvent(event, current) {
  if (event?.signal?.progress != null) return Math.max(current, Number(event.signal.progress) || current);
  if (event.kind === 'detection') return Math.max(current, 12);
  if (event.kind === 'operator') return Math.max(current, 30);
  if (event.kind === 'impact' || event.kind === 'escalation') return Math.max(current, 38);
  if (event.kind === 'signal') return Math.max(current, 58);
  if (event.kind === 'validation' && /passed|succeeded|recovery/i.test(event.message)) return 100;
  if (event.kind === 'validation') return Math.max(current, 82);
  return current;
}

function buildOperationalSnapshot(events, fallbackServices, fallbackSeverity, fallbackProgress) {
  const services = new Map((fallbackServices || []).map((service, index) => [
    service,
    index === 0 ? 'degraded' : 'at risk',
  ]));
  let severity = fallbackSeverity;
  let progress = fallbackProgress;

  for (const event of events) {
    if (event?.signal?.services?.length) {
      for (const service of event.signal.services) {
        if (!services.has(service)) services.set(service, 'at risk');
      }
    }
    if (event?.signal?.type === 'service_health') {
      for (const service of event.signal.services || []) {
        if (event.signal.status === 'healthy') {
          services.set(service, 'recovering');
        } else if (event.signal.status === 'failed') {
          services.set(service, 'failed');
        } else {
          services.set(service, 'degraded');
        }
      }
    }
    if (event?.signal?.progress != null) {
      progress = Math.max(progress, Number(event.signal.progress) || progress);
    }
    if (event?.signal?.type === 'verification_result' && event.signal.status === 'passed') {
      severity = 'SEV-3';
    } else if (event?.signal?.type === 'escalation') {
      severity = 'SEV-1';
    } else if (event?.signal?.type === 'service_health' && event.signal.status === 'degraded' && severity !== 'SEV-1') {
      severity = 'SEV-2';
    }
  }

  return {
    services: Array.from(services.entries()).slice(0, 5).map(([name, status]) => ({ name, status })),
    severity,
    progress,
  };
}

export default function LabTerminal({
  containerName,
  labId = 'default',
  incidentBrief = null,
  levelId = 'JUNIOR',
  hintEnabled = true,
  sessionId = null,
  onClose,
  onComplete,
}) {
  const wrapperRef = useRef(null);
  const viewportRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);
  const commandBufferRef = useRef('');
  const pendingOutputRef = useRef([]);
  const readyRef = useRef(false);
  const resizeObserverRef = useRef(null);
  const debouncedFitRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const onCompleteRef = useRef(onComplete);
  const sessionStartedAtRef = useRef(Date.now());

  const [hasOutput, setHasOutput] = useState(false);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [recoveryProgress, setRecoveryProgress] = useState(12);
  const [layoutMetrics, setLayoutMetrics] = useState(getAdaptiveLayoutMetrics);

  const activeIncidentBrief = normalizeIncidentBrief(incidentBrief, labId);
  const hasIncidentData =
    Boolean(activeIncidentBrief.incidentType) ||
    Boolean(activeIncidentBrief.symptoms) ||
    Boolean(activeIncidentBrief.objective) ||
    Boolean(activeIncidentBrief.successCondition) ||
    activeIncidentBrief.suggestedCommands.length > 0 ||
    activeIncidentBrief.hints.length > 0;
  const fallbackServices = deriveAffectedServices(activeIncidentBrief, labId);
  const fallbackSeverity = detectSeverity(activeIncidentBrief, labId);
  const snapshot = buildOperationalSnapshot(timelineEvents, fallbackServices, fallbackSeverity, recoveryProgress);
  const affectedServices = snapshot.services;
  const severity = snapshot.severity;
  const severityStyles = getSeverityStyles(severity);
  const recoveryStages = buildRecoveryStages(snapshot.progress);
  const escalationEvents = timelineEvents.filter((event) => event.kind === 'escalation' || event.kind === 'operator');
  const primaryService = affectedServices[0]?.name || fallbackServices[0] || 'app-service';
  const latestEvent = timelineEvents[timelineEvents.length - 1] || null;
  const degradedCount = affectedServices.filter((service) => service.status === 'degraded' || service.status === 'failed').length;
  const commandCards = activeIncidentBrief.suggestedCommands.slice(0, 3);
  const shellViewportStyle = layoutMetrics.stacked
    ? {
        minHeight: `${layoutMetrics.shellMinHeight}px`,
        height: `${layoutMetrics.shellPreferredHeight}px`,
      }
    : {
        height: '100%',
      };
  const briefPanelStyle = layoutMetrics.panelMaxHeight
    ? { maxHeight: `${layoutMetrics.panelMaxHeight}px` }
    : undefined;

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
    const syncLayout = () => setLayoutMetrics(getAdaptiveLayoutMetrics());
    syncLayout();
    window.addEventListener('resize', syncLayout);
    window.addEventListener('orientationchange', syncLayout);
    return () => {
      window.removeEventListener('resize', syncLayout);
      window.removeEventListener('orientationchange', syncLayout);
    };
  }, []);

  useEffect(() => {
    sessionStartedAtRef.current = Date.now();
    setElapsedSec(0);
    setTimelineEvents([]);
    setRecoveryProgress(12);
  }, [activeIncidentBrief, labId, sessionId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setElapsedSec((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  function addTimelineEvent(event) {
    setTimelineEvents((current) => {
      const next = {
        ...event,
        id: event.id || `${event.kind}-${Date.now()}-${current.length}`,
        atSec: event.atSec ?? elapsedSec,
      };
      if (current.some((item) => item.id === next.id)) return current;
      return [...current, next];
    });
    setRecoveryProgress((value) => deriveProgressFromEvent({
      ...event,
      atSec: event.atSec ?? elapsedSec,
    }, value));
  }

  function recordOperatorCommand(command) {
    const normalized = String(command || '').trim().toLowerCase();
    if (!normalized) return;
  }

  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;

    async function loadSessionEvents() {
      try {
        const res = await fetch(`/api/lab/events?sessionId=${encodeURIComponent(sessionId)}&limit=200`, {
          credentials: 'include',
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data.events) || cancelled) return;

        const firstTs = data.events.length > 0 ? Date.parse(data.events[0].ts || '') : Date.now();
        sessionStartedAtRef.current = Number.isFinite(firstTs) ? firstTs : Date.now();

        const mapped = data.events.map((event) => mapSessionEvent(event, sessionStartedAtRef.current));
        if (cancelled) return;
        setTimelineEvents(mapped);
        setRecoveryProgress(mapped.reduce((progress, event) => deriveProgressFromEvent(event, progress), 12));
      } catch {}
    }

    loadSessionEvents();
    const intervalId = window.setInterval(loadSessionEvents, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [sessionId]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    setHasOutput(false);
    readyRef.current = false;
    pendingOutputRef.current = [];

    const term = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: typeof window !== 'undefined' ? window.innerWidth > 640 : true,
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: getTerminalFontSize(),
      letterSpacing: 0,
      lineHeight: typeof window !== 'undefined' && window.innerWidth <= 430 ? 1.5 : 1.35,
      scrollback: 1500,
      theme: {
        background: '#07111a',
        foreground: '#d7e3f1',
        cursor: '#f59e0b',
        cursorAccent: '#07111a',
        selectionBackground: '#38bdf833',
        black: '#07111a',
        red: '#fb7185',
        green: '#34d399',
        yellow: '#fbbf24',
        blue: '#38bdf8',
        magenta: '#a78bfa',
        cyan: '#22d3ee',
        white: '#e5eef8',
        brightBlack: '#4b5563',
        brightRed: '#fda4af',
        brightGreen: '#6ee7b7',
        brightYellow: '#fde68a',
        brightBlue: '#7dd3fc',
        brightMagenta: '#c4b5fd',
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

    const ws = new WebSocket(createSocketUrl(containerName, levelId, hintEnabled, sessionId, labId));
    socketRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'ready') {
          writeChunk('\r\n\x1b[32m[WINLAB]\x1b[0m Environment ready. Begin investigation.\r\n\r\n');
          return;
        }
        if (message.type === 'lab_event' && message.event) {
          const record = message.event;
          const recordTs = Date.parse(record.ts || '') || Date.now();
          if (!sessionStartedAtRef.current) {
            sessionStartedAtRef.current = recordTs;
          }
          addTimelineEvent(mapSessionEvent(record, sessionStartedAtRef.current));
          return;
        }
        if (message.type === 'output') {
          writeChunk(message.data);
          const outputText = String(message.data || '').toLowerCase();
          if (outputText.includes('active (running)') || outputText.includes('healthy') || outputText.includes('ok')) {
            setRecoveryProgress((value) => Math.max(value, 72));
          }
          if (outputText.includes('all_checks_pass') || outputText.includes('verification passed') || outputText.includes('resolved')) {
            setRecoveryProgress((value) => 100);
          }
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
      if (data === '\u007F') {
        commandBufferRef.current = commandBufferRef.current.slice(0, -1);
      } else if (data.includes('\r')) {
        const segments = data.split('\r');
        for (let index = 0; index < segments.length; index += 1) {
          const segment = segments[index];
          if (segment) commandBufferRef.current += segment;
          if (index < segments.length - 1) {
            const command = commandBufferRef.current.trim();
            if (command) {
              recordOperatorCommand(command);
              trackEvent('command_entered', {
                labId,
                levelId,
                sessionId,
                source: 'LabTerminal',
                command,
              });
              if (/^(hint|mentor|ai)\b/i.test(command)) {
                trackEvent('hint_requested', { labId, sessionId, source: 'LabTerminal', trigger: 'typed_command' });
              }
              if (/^(verify|\.?\/?verify\.sh)\b/i.test(command) || /\bverify\.sh\b/i.test(command)) {
                trackEvent('verify_requested', { labId, levelId, sessionId, source: 'LabTerminal' });
              }
            }
            commandBufferRef.current = '';
          }
        }
      } else if (!data.startsWith('\u001b')) {
        commandBufferRef.current += data;
      }

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
      commandBufferRef.current = '';
    };
  }, [containerName, hintEnabled, labId, levelId, sessionId]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-[linear-gradient(180deg,#081019_0%,#05070c_100%)] text-slate-200">
      <div className="shrink-0 border-b border-white/8 bg-[#09111a]/95 px-4 py-3 backdrop-blur-sm sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex gap-1.5">
              <div className={`h-2.5 w-2.5 rounded-full ${severityStyles.dot}`} />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase tracking-[0.28em] text-slate-400">
                Incident Terminal
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-slate-400">
                <span className="truncate">{containerName}</span>
                <span className="uppercase text-slate-500">{severity}</span>
                <span className="uppercase text-slate-500">{primaryService}</span>
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
        <div className="grid h-full min-h-0 min-w-0 gap-3 md:gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)]">
          <div className="order-2 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[18px] border border-white/8 bg-[#07111a] shadow-[0_18px_48px_rgba(0,0,0,0.28)] md:rounded-[20px] xl:order-1">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/6 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.24em] text-slate-500 sm:px-4">
              <span>interactive shell</span>
              <span>network isolated</span>
            </div>
            {isOffline ? (
              <div className="shrink-0 border-b border-amber-400/10 bg-amber-400/10 px-4 py-2 text-xs text-amber-100">
                Connection lost. Reconnect to continue this incident.
              </div>
            ) : null}

            <div
              ref={wrapperRef}
              className="relative min-h-[360px] min-w-0 flex-1 overflow-hidden xl:min-h-0"
              style={shellViewportStyle}
            >
              <div
                ref={viewportRef}
                className="winlab-xterm-shell absolute inset-0 h-full w-full min-h-0 min-w-0 overflow-hidden px-2 py-2 sm:px-3 sm:py-3"
              />
              {!hasOutput && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-xs font-mono uppercase tracking-[0.24em] text-slate-500">
                  waiting for terminal stream
                </div>
              )}
            </div>
          </div>

          <aside
            className="order-1 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[18px] border border-white/8 bg-[#081019] md:rounded-[20px] xl:order-2 xl:max-h-none"
            style={briefPanelStyle}
          >
            <div className="border-b border-white/8 bg-[#0a131c] px-3 py-3 sm:px-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-slate-400">Live Incident Intelligence</p>
                  <h2 className="mt-2 text-base font-black text-white sm:text-lg">
                    {activeIncidentBrief.incidentType || 'Brief unavailable'}
                  </h2>
                </div>
                <div className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${severityStyles.pill}`}>
                  {severity}
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {activeIncidentBrief.labTitle || 'No lab metadata was attached to this session.'}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                <span>Session {sessionId || 'pending'}</span>
                {activeIncidentBrief.labId ? <span>{activeIncidentBrief.labId}</span> : null}
                <span>{primaryService}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-px border-b border-white/8 bg-white/8 lg:grid-cols-4">
              <div className="bg-[#09111a] px-3 py-3 sm:px-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Incident timer</p>
                <p className="mt-2 font-mono text-lg font-semibold text-white sm:text-xl">{formatElapsed(elapsedSec)}</p>
              </div>
              <div className="bg-[#09111a] px-3 py-3 sm:px-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Recovery progress</p>
                <p className="mt-2 font-mono text-lg font-semibold text-white sm:text-xl">{snapshot.progress}%</p>
              </div>
              <div className="bg-[#09111a] px-3 py-3 sm:px-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Affected now</p>
                <p className="mt-2 font-mono text-lg font-semibold text-white sm:text-xl">{affectedServices.length}</p>
              </div>
              <div className="bg-[#09111a] px-3 py-3 sm:px-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Open impact</p>
                <p className="mt-2 font-mono text-lg font-semibold text-white sm:text-xl">{degradedCount}</p>
              </div>
            </div>

            <div className="grid gap-px border-b border-white/8 bg-white/6 lg:grid-cols-[1fr_1fr]">
              <div className="bg-[#09111a] px-3 py-3 sm:px-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Current state</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-200">
                  {latestEvent?.message || 'Session initialized. Awaiting operator actions and system signals.'}
                </p>
              </div>
              <div className="bg-[#09111a] px-3 py-3 sm:px-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Response posture</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-200">
                  {degradedCount > 0
                    ? `${degradedCount} service scope still degraded. Keep mitigation active and verify recovery before closeout.`
                    : 'No degraded services in the latest signal set. Focus on validation and closeout checks.'}
                </p>
              </div>
            </div>

            <div className="min-h-0 space-y-3 overflow-y-auto p-2.5 text-sm sm:p-3">
              <section className="border border-white/8 bg-black/20">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="px-3 pt-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Recovery stages</p>
                  <p className="px-3 pt-3 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{severityStyles.label} incident</p>
                </div>
                <div className="mx-3 mb-3 h-1.5 overflow-hidden bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300 transition-all duration-500"
                    style={{ width: `${Math.max(6, snapshot.progress)}%` }}
                  />
                </div>
                <div className="grid gap-px bg-white/6">
                  {recoveryStages.map((stage) => (
                    <div key={stage.label} className="flex items-center justify-between bg-[#09111a] px-3 py-2">
                      <span className="text-xs text-slate-300">{stage.label}</span>
                      <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${stage.done ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {stage.done ? 'done' : 'pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="border border-white/8 bg-black/20">
                <p className="px-3 py-3 text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Affected services</p>
                <div className="grid gap-px bg-white/6">
                  {affectedServices.map((service, index) => {
                    return (
                      <div key={service.name} className="flex items-center justify-between bg-[#09111a] px-3 py-2">
                        <span className="font-mono text-[11px] text-slate-200">{service.name}</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${
                          service.status === 'recovering'
                            ? 'border border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                            : service.status === 'failed'
                              ? 'border border-rose-500/30 bg-rose-500/15 text-rose-100'
                            : service.status === 'degraded'
                              ? 'border border-rose-400/20 bg-rose-400/10 text-rose-200'
                              : 'border border-amber-400/20 bg-amber-400/10 text-amber-100'
                        }`}>
                          {service.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {commandCards.length > 0 ? (
                <section className="border border-white/8 bg-black/20">
                  <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Command focus</p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">next likely actions</p>
                  </div>
                  <div className="space-y-px bg-white/6">
                    {commandCards.map((command) => (
                      <div key={command} className="bg-[#09111a] px-3 py-3">
                        <p className="font-mono text-[11px] leading-relaxed text-slate-200">{command}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="border border-white/8 bg-black/20">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Live event timeline</p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">latest 8 events</p>
                </div>
                <div className="space-y-px bg-white/6">
                  {timelineEvents.length === 0 ? (
                    <div className="bg-[#09111a] px-3 py-3 text-xs text-slate-400">
                      Waiting for incident events...
                    </div>
                  ) : (
                    timelineEvents.slice(-8).map((event) => (
                      <div key={event.id} className="bg-[#09111a] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">{formatElapsed(event.atSec || 0)}</span>
                          <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${
                            event.severity === 'critical'
                              ? 'text-rose-200'
                              : event.severity === 'high'
                                ? 'text-amber-100'
                                : 'text-sky-100'
                          }`}>
                            {event.actor}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                          <span>{event.kind}</span>
                          <span>/</span>
                          <span>{event.severity}</span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-200">{event.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="border border-white/8 bg-black/20">
                <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Escalation log</p>
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">operator and on-call</p>
                </div>
                <div className="space-y-px bg-white/6">
                  {escalationEvents.length === 0 ? (
                    <div className="bg-[#09111a] px-3 py-3 text-xs text-slate-400">
                      No escalation entries yet.
                    </div>
                  ) : (
                    escalationEvents.slice(-4).map((event) => (
                      <div key={`esc-${event.id}`} className="bg-[#09111a] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{formatElapsed(event.atSec || 0)}</span>
                          <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">{event.actor}</span>
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-slate-200">{event.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {!hasIncidentData ? (
                <section className="border border-white/8 bg-black/20 p-4">
                  <p className="text-sm leading-relaxed text-slate-300">
                    Lab briefing is unavailable for this session. Start the lab again or inspect the terminal directly.
                  </p>
                </section>
              ) : null}

              {activeIncidentBrief.symptoms ? (
                <section className="border border-white/8 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Symptoms</p>
                  <p className="mt-3 text-sm leading-relaxed text-white">{activeIncidentBrief.symptoms}</p>
                </section>
              ) : null}

              {activeIncidentBrief.objective ? (
                <section className="border border-white/8 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Objective</p>
                  <p className="mt-3 text-sm leading-relaxed text-white">{activeIncidentBrief.objective}</p>
                </section>
              ) : null}

              {activeIncidentBrief.successCondition ? (
                <section className="border border-white/8 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Success condition</p>
                  <p className="mt-3 text-sm leading-relaxed text-white">{activeIncidentBrief.successCondition}</p>
                </section>
              ) : null}

              {activeIncidentBrief.hints.length > 0 ? (
                <section className="border border-white/8 bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Operational notes</p>
                  <div className="mt-3 space-y-2 text-xs text-slate-300">
                    {activeIncidentBrief.hints.map((hint, index) => (
                      <div key={`${index}-${hint}`} className="border border-white/6 bg-white/[0.03] px-3 py-2">
                        {hint}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
