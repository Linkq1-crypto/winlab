// FakeTerminal.jsx — Honeypot: fake admin terminal that logs everything
import React, { useState, useEffect, useRef } from 'react';

const ASCII_ART = {
  troll: `
     ______________________
    < U MAD BRO? NO PLANS  >
     ----------------------
            \\   ^__^
             \\  (oo)\\_______
                (__)\\       )\\/\\
                    ||----w |
                    ||     ||
  `,
  middle_finger: `
       _

      | |
      | | __
      | |/  |
      | / / |
    _ |/ / /
   \\ \\/ / /
    \\    /

     |  |
  `,
};

const FAKE_FILES = [
  { name: 'shadow.bak', content: 'cm9vdDokNiRyb3VuZHMuYXV0bzoxMjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo=\nYWxzaGFkb3c6JDUkcm91bmRzLmF1dG86YWJjZGVmZzEyMzQ1Njc4OTA=' },
  { name: 'wireguard_private.key', content: 'ERROR: KEY_REVOKED_BY_ADMIN_LOCAL_ONLY' },
  { name: 'secret_plans.txt', content: ASCII_ART.troll },
  { name: 'passwords_do_not_open.db', content: '[BINARY CORRUPTED] 0xDEADBEEF 0xCAFEBABE' },
  { name: 'config.json', content: '{ "api_status": "offline", "debug": true, "backdoor": null }' },
  { name: 'system_logs', content: 'Generating... [404: Buffer Overflow Simulated]' },
];

function playDing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch { /* audio blocked */ }
}

function honeypotLog(action, detail) {
  console.log(`[HONEYPOT ${new Date().toISOString()}] ${action}: ${detail}`);
  // Could POST to real backend here for analytics
}

export default function FakeTerminal() {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([
    { cmd: '', res: 'LABOS v1.0.4 - Restricted Access Only', type: 'system' },
    { cmd: '', res: 'Type "help" for available commands.', type: 'system' },
  ]);
  const [isError, setIsError] = useState(false);
  const [sessionStart] = useState(Date.now());
  const dummyRef = useRef(null);

  useEffect(() => {
    dummyRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    honeypotLog('SESSION_STARTED', `User-Agent: ${navigator.userAgent}`);
    return () => {
      const duration = Math.round((Date.now() - sessionStart) / 1000);
      honeypotLog('SESSION_ENDED', `Duration: ${duration}s`);
    };
  }, []);

  const triggerError = () => {
    setIsError(true);
    playDing();
    setTimeout(() => setIsError(false), 300);
  };

  const commands = {
    help: 'Available: ls, whoami, sudo, cat, rm, clear, hack, exit, date, uname, ps, id',
    ls: 'etc/  bin/  var/  secret_plans.txt  passwords_do_not_open.db  .ssh/  .env',
    whoami: "You are a 'guest' with zero privileges. Stop dreaming.",
    sudo: 'Nice try. Incident reported to Santa Claus.',
    hack: 'Accessing mainframe... [██████████] 100% | Status: You\'ve been rickrolled.',
    rm: "Error: You can't even delete your browser history, let alone my files.",
    cat: 'Usage: cat <filename>. Try: cat secret_plans.txt, cat shadow.bak, cat config.json',
    clear: 'CLEAR',
    exit: 'There is no escape. Nice try though.',
    date: new Date().toISOString(),
    uname: 'LABOS honeypot-node 1.0.4 x86_64 GNU/Linux (FAKE)',
    ps: '  PID TTY          TIME CMD\n    1 ?        00:00:00 systemd\n  847 ?        00:00:00 honeypot-daemon\n  999 pts/0    00:00:00 YOU_ARE_BEING_WATCHED',
    id: 'uid=65534(nobody) gid=65534(nogroup) groups=65534(nogroup)',
  };

  const handleCommand = (e) => {
    if (e.key === 'Enter') {
      const inputTrimmed = input.trim();
      const cmdLower = inputTrimmed.toLowerCase();
      let res = '';

      honeypotLog('COMMAND', cmdLower);

      if (cmdLower === 'clear') {
        setHistory([]);
        setInput('');
        return;
      }

      // Special cat handling
      if (cmdLower.startsWith('cat ')) {
        const file = cmdLower.slice(4).trim();
        const found = FAKE_FILES.find(f => f.name === file || cmdLower.includes(f.name));
        if (found) {
          res = found.content;
          if (found.name.includes('secret')) {
            honeypotLog('SECURITY_ALERT', 'User accessed secret files!');
          }
        } else {
          res = `cat: ${file}: No such file or directory`;
          triggerError();
        }
      } else if (commands[cmdLower]) {
        res = commands[cmdLower];
      } else if (cmdLower === '') {
        setInput('');
        return;
      } else {
        res = `bash: ${inputTrimmed}: command not found. Try 'help' or rethink your life.`;
        triggerError();
      }

      setHistory(prev => [...prev, { cmd: `root@lab-os:~$ ${inputTrimmed}`, res, type: isError ? 'error' : 'normal' }]);
      setInput('');
    }
  };

  return (
    <div
      className={`font-mono rounded-lg overflow-hidden shadow-2xl border-2 transition-all duration-150 ${
        isError ? 'border-red-600 shadow-red-600/40' : 'border-[#333]'
      }`}
      style={{
        '--cursor-color': isError ? '#ff0000' : '#00ff41',
      }}
    >
      {/* Terminal header bar */}
      <div className="bg-[#1a1a1a] px-4 py-2 flex items-center gap-2 border-b border-[#333]">
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <div className="w-3 h-3 rounded-full bg-yellow-500" />
        <div className="w-3 h-3 rounded-full bg-green-500" />
        <span className="text-xs text-slate-500 ml-2">root@lab-os — Restricted Shell</span>
      </div>

      {/* Terminal body */}
      <div
        className={`bg-[#0a0a0a] text-[#00ff41] p-6 h-[500px] overflow-y-auto ${
          isError ? 'animate-[shake_0.2s_ease-in-out]' : ''
        }`}
      >
        {history.map((line, i) => (
          <div key={i} className="mb-2">
            {line.cmd && <div className="text-white">{line.cmd}</div>}
            <div
              className="opacity-80 leading-tight"
              style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
            >
              {line.res}
            </div>
          </div>
        ))}

        <div className="flex items-center mt-1">
          <span className="text-white mr-2 shrink-0">root@lab-os:~$</span>
          <input
            autoFocus
            className="bg-transparent outline-none flex-1 text-[#00ff41] caret-transparent"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleCommand}
          />
          {/* Custom blinking cursor */}
          <span
            className="inline-block w-[10px] h-5 ml-1 shrink-0"
            style={{
              backgroundColor: 'var(--cursor-color)',
              animation: 'blink 1s step-end infinite',
            }}
          />
        </div>
        <div ref={dummyRef} />
      </div>

      {/* Injected keyframes */}
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
