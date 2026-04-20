import { useState, useEffect, useRef } from "react";

const LOG_POOLS = {
  nginx_access: [
    '10.0.2.100 - - [{ts}] "GET /api/health HTTP/1.1" 200 42 "-" "curl/7.81.0"',
    '10.0.2.101 - - [{ts}] "POST /api/users HTTP/1.1" 201 156 "-" "axios/1.4.0"',
    '10.0.2.102 - - [{ts}] "GET /assets/index.js HTTP/1.1" 304 0 "https://app.example.com" "Mozilla/5.0"',
    '10.0.2.100 - - [{ts}] "GET / HTTP/1.1" 200 4821 "-" "Mozilla/5.0"',
    '10.0.2.103 - - [{ts}] "PUT /api/settings HTTP/1.1" 200 88 "-" "okhttp/4.11.0"',
    '10.0.2.104 - - [{ts}] "DELETE /api/sessions/abc HTTP/1.1" 204 0 "-" "axios/1.4.0"',
  ],
  nginx_error: [
    '{ts} [warn] 4821#4821: *14821 upstream response timeout while reading upstream',
    '{ts} [error] 4821#4821: *14822 connect() failed (111: Connection refused) while connecting to upstream',
    '{ts} [info] 4821#4821: *14823 client closed connection while waiting for request',
  ],
  messages: [
    'Apr 20 {ts} {host} systemd[1]: Started Session {n} of user root.',
    'Apr 20 {ts} {host} kernel: eth0: renamed from veth{rand}',
    'Apr 20 {ts} {host} chronyd[812]: Selected source 185.125.190.58 (pool.ntp.org)',
    'Apr 20 {ts} {host} systemd[1]: systemd-logind.service: Watchdog keepalive',
    'Apr 20 {ts} {host} sshd[4001]: Accepted publickey for root from 10.0.2.10 port 54322',
  ],
  secure: [
    'Apr 20 {ts} {host} sshd[4001]: Accepted publickey for root from 10.0.2.10 port 54322 ssh2',
    'Apr 20 {ts} {host} sshd[4001]: pam_unix(sshd:session): session opened for user root by (uid=0)',
    'Apr 20 {ts} {host} sudo[4122]:     root : TTY=pts/0 ; PWD=/root ; USER=root ; COMMAND=/bin/systemctl status nginx',
    'Apr 20 {ts} {host} sudo[4123]:     root : TTY=pts/0 ; PWD=/root ; USER=root ; COMMAND=/usr/bin/tail -f /var/log/secure',
  ],
  pm2: [
    '{ts} +0000 [{n}|myapp] server listening on port 3001',
    '{ts} +0000 [{n}|myapp] GET /api/health 200 4ms',
    '{ts} +0000 [{n}|myapp] GET /api/users 200 12ms',
    '{ts} +0000 [{n}|myapp] POST /api/auth 201 38ms',
    '{ts} +0000 [{n}|myapp] connected to db at db.example.com:5432',
  ],
};

function getPool(path) {
  if (path.includes("access")) return LOG_POOLS.nginx_access;
  if (path.includes("error"))  return LOG_POOLS.nginx_error;
  if (path.includes("secure")) return LOG_POOLS.secure;
  if (path.includes("pm2") || path.includes("app.log")) return LOG_POOLS.pm2;
  return LOG_POOLS.messages;
}

function formatLine(tpl, host) {
  const now  = new Date();
  const ts   = now.toTimeString().slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 8);
  const n    = Math.floor(Math.random() * 9999);
  return tpl
    .replace("{ts}",   ts)
    .replace("{host}", host || "server01")
    .replace("{rand}", rand)
    .replace("{n}",    String(n));
}

export default function TerminalTail({ path, instanceId, onExit }) {
  const [lines, setLines] = useState([]);
  const ref      = useRef();
  const bottomRef = useRef();
  const tickRef  = useRef(0);

  useEffect(() => {
    ref.current?.focus();
    const pool    = getPool(path);
    const initial = pool.slice(-4).map(t => ({ text: formatLine(t, instanceId), type: "out" }));
    setLines(initial);

    const iv = setInterval(() => {
      tickRef.current++;
      const tpl  = pool[tickRef.current % pool.length];
      const text = formatLine(tpl, instanceId);
      setLines(l => [...l.slice(-80), { text, type: "out" }]);
    }, 1200 + Math.random() * 1400);

    return () => clearInterval(iv);
  }, [path, instanceId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  function handleKey(e) {
    if (e.ctrlKey && e.key === "c") { e.preventDefault(); onExit(); }
  }

  return (
    <div ref={ref} tabIndex={0} onKeyDown={handleKey}
      style={{ position:"absolute", inset:0, background:"#060809", fontFamily:"'JetBrains Mono','Fira Code',monospace", fontSize:12, color:"#c8d8c8", overflowY:"auto", padding:"8px 12px", outline:"none" }}>
      <div style={{ color:"#334", marginBottom:4 }}>{"==> "}{path}{" <=="}</div>
      {lines.map((l, i) => (
        <div key={i} style={{ lineHeight:1.55, color: l.text.includes("error")||l.text.includes("Error") ? "#e06060" : l.text.includes("warn") ? "#ffaa00" : "#b8d0c8", whiteSpace:"pre-wrap" }}>
          {l.text}
        </div>
      ))}
      <div ref={bottomRef} />
      <div style={{ color:"#334", fontSize:11, marginTop:6, position:"sticky", bottom:0, background:"#060809" }}>
        Ctrl+C — interrupt (watching {path})
      </div>
    </div>
  );
}
