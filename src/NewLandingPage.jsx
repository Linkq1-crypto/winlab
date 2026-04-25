// NewLandingPage.jsx — redesign da winlab-redesign.html + lab interattivi
import { useState, useEffect, useRef } from "react";
import { getVariant } from "./ABTestOnboarding";
import CookieBanner from "./CookieBanner";
import { initPosthog } from "./services/posthog";
import FreeLabTerminal from "./components/FreeLabTerminal.jsx";

function track(event, props = {}) {
  try { if (window.posthog) window.posthog.capture(event, props); } catch {}
}

// ── Scenari lab interattivi ───────────────────────────────────────────────────
const SCENARIOS = {
  nginx: {
    alert: "nginx is down.\nusers are failing.\n\nyou have access.\n\nfix it.",
    init: [
      "[prod-eu-west-1] — connected", "",
      "$ systemctl status nginx",
      "✖ nginx.service — failed (Result: exit-code)",
      "  Main PID: 1823 (code=exited, status=1/FAILURE)", "",
      "$ curl -I http://localhost",
      "curl: (7) Failed to connect to localhost port 80", "",
    ],
    hint: "try: sudo systemctl restart nginx",
    eval(cmd) {
      const c = cmd.trim().toLowerCase();
      if (["sudo systemctl restart nginx","systemctl restart nginx","sudo service nginx restart","service nginx restart"].includes(c)) return "success";
      if (c.includes("status") && c.includes("nginx")) return { out: ["✖ nginx.service — failed (see journalctl -xe)"] };
      if (c.includes("journalctl") || c.includes("log")) return { out: ["Apr 21 nginx[1823]: bind() to 0.0.0.0:80 failed (98: Address in use)"] };
      return "fail";
    },
    success: ["✔ nginx running (pid: 2847)", "", "$ curl -I http://localhost", "HTTP/1.1 200 OK", "Server: nginx/1.24.0", "", "Service restored."],
  },
  disk: {
    alert: "disk at 100%.\nwrites failing.\n\nyou have access.\n\nclear space.",
    init: [
      "[prod-eu-west-1] — connected", "",
      "$ df -h /",
      "Filesystem  Size  Used Avail Use%",
      "/dev/sda1    20G   20G     0 100%", "",
      "$ tail /var/log/nginx/access.log",
      "tail: cannot open: No space left on device", "",
    ],
    hint: "try: truncate -s 0 /var/log/nginx/access.log",
    eval(cmd) {
      const c = cmd.trim().toLowerCase();
      if (c.includes("truncate") || c.includes("rm /var/log") || c.includes("find /var/log") || c.includes("> /var/log")) return "success";
      if (c.includes("df")) return { out: ["/dev/sda1    20G   20G     0 100%"] };
      if (c.includes("du")) return { out: [" 18G\t/var/log/nginx/access.log"] };
      return "fail";
    },
    success: ["✔ truncated /var/log/nginx/access.log", "", "$ df -h /", "/dev/sda1  20G  2.1G  18G  11%", "", "Space restored."],
  },
  ssh: {
    alert: "ssh refusing connections.\nteam is locked out.\n\nyou have console access.\n\nfix it.",
    init: [
      "[prod-eu-west-1] — console access", "",
      "$ systemctl status ssh",
      "✖ ssh.service — failed",
      "  Process: sshd -D (code=exited, status=255)", "",
      "$ journalctl -u ssh -n 3",
      "sshd[921]: /etc/ssh/sshd_config line 14: Bad configuration option",
      "sshd[921]: bad configuration options; terminating", "",
    ],
    hint: "try: sed -i '14d' /etc/ssh/sshd_config && systemctl restart ssh",
    eval(cmd) {
      const c = cmd.trim().toLowerCase();
      if ((c.includes("sed") || c.includes("vi") || c.includes("nano")) && c.includes("sshd_config") && c.includes("restart")) return "success";
      if (c.includes("systemctl restart ssh") && !c.includes("sshd_config")) return { out: ["Job for ssh.service failed. Check journalctl -xe."] };
      if (c.includes("sshd_config")) return { out: ["line 14: PermitRootLogin bad_value  ← syntax error"] };
      return "fail";
    },
    success: ["✔ sshd config fixed", "✔ ssh.service running (pid: 1042)", "", "$ ssh admin@prod-server", "Welcome to Ubuntu 22.04", "", "Access restored."],
  },
};

// ── Terminal generico ─────────────────────────────────────────────────────────
function Terminal({ variant = "B", scenarioKey = "nginx", onSuccess, compact = false }) {
  const sc = SCENARIOS[scenarioKey];
  const [lines, setLines]       = useState(sc.init);
  const [input, setInput]       = useState("");
  const [done, setDone]         = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [firstKey, setFirstKey] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => { const t = setTimeout(() => setShowHint(true), 2500); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const t = setTimeout(() => { if (!firstKey) setLines(l => [...l, "// the system is still down."]); }, 5000);
    return () => clearTimeout(t);
  }, [firstKey]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [lines]);

  function submit(e) {
    e.preventDefault();
    if (!input.trim() || done) return;
    if (!firstKey) { setFirstKey(true); track("first_keypress", { variant, lab: scenarioKey }); }
    const result = sc.eval(input);
    if (result === "success") {
      setLines(l => [...l, `$ ${input}`, ...sc.success]);
      setDone(true);
      track("command_success", { variant, lab: scenarioKey });
      setTimeout(() => onSuccess?.(), 3000);
    } else if (result === "fail") {
      track("command_fail", { variant, lab: scenarioKey, cmd: input.split(" ")[0] });
      setLines(l => [...l, `$ ${input}`, `bash: ${input.split(" ")[0]}: command not found`]);
    } else {
      setLines(l => [...l, `$ ${input}`, ...result.out]);
    }
    setInput("");
  }

  function lc(l) {
    if (l.startsWith("✖") || l.includes("failed") || l.includes("Failed") || l.includes("refused") || l.includes("100%")) return "#ff5f57";
    if (l.startsWith("✔") || l.startsWith("HTTP/1.1 200") || l.endsWith("restored.") || l.includes("11%") || l.includes("200 OK")) return "#22c55e";
    if (l.startsWith("$")) return "#f0f0f0";
    if (l.startsWith("//")) return "rgba(255,76,0,0.6)";
    if (l.startsWith("[prod")) return "rgba(255,76,0,0.8)";
    return "#666";
  }

  return (
    <div style={{ background:"#111", border:"1px solid #2a2a2a", fontFamily:"'IBM Plex Mono',monospace", fontSize:12, cursor:"text" }}
      onClick={() => inputRef.current?.focus()}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", borderBottom:"1px solid #1a1a1a", background:"#0d0d0d" }}>
        <div style={{ display:"flex", gap:6 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#ff5f57" }} />
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#ffbd2e" }} />
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#28c840" }} />
        </div>
        <span style={{ color:"#555", fontSize:11, letterSpacing:"0.05em" }}>prod-eu-west-1 — bash</span>
        <span style={{ color:"#22c55e", fontSize:10 }}>● live</span>
      </div>
      <div style={{ padding:"20px 24px", lineHeight:1.8, maxHeight: compact ? 240 : 320, overflowY:"auto" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: lc(l) }}>{l || "\u00A0"}</div>
        ))}
        <div ref={bottomRef} />
      </div>
      {!done && (
        <div style={{ padding:"0 24px 16px", borderTop:"1px solid #1a1a1a" }}>
          <form onSubmit={submit} style={{ display:"flex", alignItems:"center", gap:8, paddingTop:12 }}>
            <span style={{ color:"#22c55e" }}>$</span>
            <input
              ref={inputRef} autoFocus value={input}
              onChange={e => setInput(e.target.value)}
              style={{ background:"transparent", border:"none", outline:"none", flex:1, color:"#f0f0f0", fontFamily:"'IBM Plex Mono',monospace", fontSize:12, caretColor:"#ff4c00" }}
              placeholder="type a command…" autoComplete="off" spellCheck={false}
            />
          </form>
        </div>
      )}
      {showHint && !done && (
        <div style={{ padding:"0 24px 14px" }}>
          {!hintOpen
            ? <button onClick={() => { setHintOpen(true); track("hint_open", { variant, lab: scenarioKey }); }}
                style={{ background:"none", border:"none", color:"#ff4c00", fontFamily:"'IBM Plex Mono',monospace", fontSize:10, cursor:"pointer", opacity:0.6 }}>
                hint available →
              </button>
            : <span style={{ color:"#ff4c00", fontSize:10, fontFamily:"'IBM Plex Mono',monospace", opacity:0.8 }}>{sc.hint}</span>
          }
        </div>
      )}
    </div>
  );
}

// ── Lab modal ─────────────────────────────────────────────────────────────────
function LabModal({ scenarioKey, onSuccess, onClose }) {
  const sc = SCENARIOS[scenarioKey];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:24 }}>
      <div style={{ width:"100%", maxWidth:640 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", color:"#888", fontSize:12, lineHeight:1.8, whiteSpace:"pre-line" }}>{sc.alert}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, marginLeft:24, flexShrink:0 }}>esc ×</button>
        </div>
        <Terminal variant="lab" scenarioKey={scenarioKey} onSuccess={onSuccess} />
      </div>
    </div>
  );
}

// ── Signup modal ──────────────────────────────────────────────────────────────
async function doCheckout(plan = "early") {
  try {
    const r = await fetch("/api/billing/checkout", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ plan }) });
    const d = await r.json();
    if (d.url) window.location.href = d.url;
    else window.location.href = "/?pricing=1";
  } catch { window.location.href = "/?pricing=1"; }
}

function SignupModal({ variant, onLogin, onRegister, onSkip }) {
  useEffect(() => { track("signup_open", { variant }); }, []);
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300, padding:16 }}>
      <div style={{ background:"#111", border:"1px solid #2a2a2a", padding:40, width:"100%", maxWidth:400, marginBottom: 16 }}>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#333", letterSpacing:"0.25em", textTransform:"uppercase", marginBottom:24 }}>WINLAB — ACCESS CONTROL</div>
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", color:"#22c55e", fontSize:14, marginBottom:6 }}>You fixed a production issue.</div>
        <div style={{ color:"#666", fontSize:13, marginBottom:28, fontFamily:"'IBM Plex Sans',sans-serif", fontWeight:300 }}>Most people can't. Save your progress.</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <button onClick={() => { track("signup_free_click", { variant }); onRegister(); }}
            style={{ background:"#fff", color:"#000", border:"none", padding:"14px 24px", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:500, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
            Start free — 6 labs
          </button>
          <button onClick={() => { track("checkout_click", { variant }); doCheckout("early"); }}
            style={{ background:"transparent", color:"#ff4c00", border:"1px solid rgba(255,76,0,0.4)", padding:"14px 24px", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
            Unlock all 24 labs — $5/mo →
          </button>
          <button onClick={() => { track("signin_click", { variant }); onLogin(); }}
            style={{ background:"none", border:"none", color:"#555", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, cursor:"pointer", padding:"8px 0" }}>
            Already have an account? Sign in
          </button>
        </div>
        <button onClick={() => { track("signup_skip", { variant }); onSkip(); }}
          style={{ background:"none", border:"none", color:"#222", fontFamily:"'IBM Plex Mono',monospace", fontSize:10, cursor:"pointer", padding:"12px 0 0", width:"100%" }}>
          skip for now
        </button>
      </div>
    </div>
  );
}

// ── Labs data ─────────────────────────────────────────────────────────────────
const LABS = [
  { key:"nginx", tier:"free",  icon:"🌐", name:"Nginx Down",     desc:"Web server is down. Users are getting errors. Diagnose and restore service.",       time:"15 min", rating:"4.9" },
  { key:"disk",  tier:"free",  icon:"💾", name:"Disk Full",      desc:"Server running out of disk space. Services failing. Find it and fix it.",            time:"20 min", rating:"4.8" },
  { key:null,    tier:"pro",   icon:"🐳", name:"Docker Crash",   desc:"A critical container keeps crashing. Find the root cause and fix the config.",       time:"25 min", rating:"4.9" },
  { key:null,    tier:"pro",   icon:"🔒", name:"TLS Expired",    desc:"Certificate expired. HTTPS is down. Diagnose, renew, and restore in time.",          time:"26 min", rating:"4.7" },
  { key:"ssh",   tier:"free",  icon:"🖥️", name:"SSH Refused",    desc:"Locked out of your own server. Get back in without a reboot.",                      time:"18 min", rating:"4.8" },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function NewLandingPage({ onLogin, onRegister }) {
  const [variant]    = useState(() => getVariant());
  const [heroReady,  setHeroReady]  = useState(variant === "B");
  const [showSignup, setShowSignup] = useState(false);
  const [activeLab,  setActiveLab]  = useState(null);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    initPosthog();
    track("view_landing", { variant });
    if (variant === "C") {
      const t = setTimeout(() => setHeroReady(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  function handleSuccess() { setActiveLab(null); setShowSignup(true); }

  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Bebas+Neue&family=IBM+Plex+Sans:wght@300;400;500&display=swap');
    :root {
      --black:#0a0a0a; --black-2:#111; --black-3:#1a1a1a;
      --border:#2a2a2a; --border-light:#333;
      --text-dim:#555; --text-mid:#888; --text-light:#bbb;
      --white:#f0f0f0; --white-pure:#fff;
      --orange:#ff4c00; --orange-dim:rgba(255,76,0,0.15);
      --green:#22c55e; --yellow:#eab308;
      --mono:'IBM Plex Mono',monospace;
      --display:'Bebas Neue',sans-serif;
      --body:'IBM Plex Sans',sans-serif;
    }
    .wl-body { background:var(--black); color:var(--white); font-family:var(--body); font-weight:300; overflow-x:hidden; }
    .wl-body::before { content:''; position:fixed; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events:none; z-index:9999; opacity:0.6; }
    @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
    @keyframes show { from{opacity:0} to{opacity:1} }
    .fade-1{opacity:0;animation:fadeUp 0.6s ease forwards 0.2s}
    .fade-2{opacity:0;animation:fadeUp 0.6s ease forwards 0.35s}
    .fade-3{opacity:0;animation:fadeUp 0.6s ease forwards 0.5s}
    .fade-4{opacity:0;animation:fadeUp 0.6s ease forwards 0.65s}
    .fade-5{opacity:0;animation:fadeUp 0.6s ease forwards 0.8s}
    .fade-term{opacity:0;animation:fadeUp 0.6s ease forwards 0.4s}
    .btn-primary { font-family:var(--mono); font-size:12px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:var(--black); background:var(--white-pure); border:none; padding:16px 36px; cursor:pointer; transition:all 0.25s; text-decoration:none; display:inline-block; position:relative; }
    .btn-primary::after { content:''; position:absolute; bottom:-3px; right:-3px; width:100%; height:100%; border:1px solid var(--orange); transition:all 0.25s; pointer-events:none; }
    .btn-primary:hover { background:var(--orange); color:var(--white-pure); }
    .btn-primary:hover::after { bottom:-6px; right:-6px; }
    .btn-ghost { font-family:var(--mono); font-size:11px; letter-spacing:0.1em; text-transform:uppercase; color:var(--text-mid); text-decoration:none; display:flex; align-items:center; gap:8px; transition:color 0.2s; background:none; border:none; cursor:pointer; }
    .btn-ghost:hover { color:var(--white); }
    .btn-large { font-family:var(--mono); font-size:13px; font-weight:500; letter-spacing:0.1em; text-transform:uppercase; color:var(--black); background:var(--white-pure); border:none; padding:20px 48px; cursor:pointer; transition:all 0.25s; text-decoration:none; display:inline-block; position:relative; }
    .btn-large::after { content:''; position:absolute; bottom:-4px; right:-4px; width:100%; height:100%; border:1px solid var(--orange); transition:all 0.25s; pointer-events:none; }
    .btn-large:hover { background:var(--orange); color:var(--white-pure); }
    .btn-large:hover::after { bottom:-8px; right:-8px; }
    .lab-card { padding:32px 28px; border-right:1px solid var(--border); position:relative; cursor:pointer; transition:background 0.25s; display:flex; flex-direction:column; }
    .lab-card:last-child { border-right:none; }
    .lab-card:hover { background:var(--black-3); }
    .step { padding:48px 40px; border-right:1px solid var(--border); position:relative; transition:background 0.3s; }
    .step:last-child { border-right:none; }
    .step:hover { background:var(--black-3); }
    .step:hover .step-icon { border-color:var(--orange); background:var(--orange-dim); }
    .stat-item { padding:60px 48px; border-right:1px solid var(--border); position:relative; overflow:hidden; }
    .stat-item:last-child { border-right:none; }
    .stat-item::before { content:''; position:absolute; bottom:0; left:0; right:0; height:2px; background:var(--orange); transform:scaleX(0); transform-origin:left; transition:transform 0.4s ease; }
    .stat-item:hover::before { transform:scaleX(1); }
    .quote-stat-row { padding:32px 40px; background:var(--black-2); border:1px solid var(--border); margin-bottom:1px; display:flex; justify-content:space-between; align-items:center; transition:background 0.25s,border-color 0.25s; }
    .quote-stat-row:hover { background:var(--black-3); border-color:var(--orange); }
    .nav-link { font-family:var(--mono); font-size:11px; font-weight:400; letter-spacing:0.15em; text-transform:uppercase; color:var(--text-mid); text-decoration:none; transition:color 0.2s; background:none; border:none; cursor:pointer; }
    .nav-link:hover { color:var(--white); }
    .section-label { font-family:var(--mono); font-size:10px; font-weight:500; letter-spacing:0.3em; text-transform:uppercase; color:var(--orange); display:flex; align-items:center; gap:12px; margin-bottom:20px; }
    .section-label::before { content:''; width:32px; height:1px; background:var(--orange); }
    @media(max-width:900px) {
      .hero-grid { grid-template-columns:1fr !important; }
      .hero-left { border-right:none !important; padding:60px 24px !important; }
      .hero-right { padding:0 24px 60px !important; }
      .steps-grid { grid-template-columns:1fr !important; }
      .step { border-right:none !important; border-bottom:1px solid var(--border); }
      .stats-grid { grid-template-columns:1fr 1fr !important; }
      .stat-item { border-right:none !important; border-bottom:1px solid var(--border); }
      .labs-grid { grid-template-columns:1fr 1fr !important; }
      .lab-card { border-right:none !important; border-bottom:1px solid var(--border); }
      .quote-grid { grid-template-columns:1fr !important; }
      .section-how,.section-labs,.section-quote,.section-cta { padding:80px 24px !important; }
      .footer-grid { grid-template-columns:1fr 1fr !important; padding:40px 24px !important; }
      .footer-bottom { padding:20px 24px !important; flex-direction:column; gap:8px; }
      .nav-links-desktop { display:none !important; }
      .nav-mobile-btn { display:flex !important; }
    }
    @media(min-width:901px) { .nav-mobile-btn { display:none !important; } }
  `;

  return (
    <div className="wl-body">
      <style>{CSS}</style>

      {/* ── NAV ── */}
      <nav style={{ position:"fixed", top:0, left:0, right:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 48px", height:64, background:"rgba(10,10,10,0.92)", backdropFilter:"blur(12px)", borderBottom:"1px solid #2a2a2a" }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:15, fontWeight:600, letterSpacing:"0.05em", color:"#fff" }}>
          WIN<span style={{ color:"#ff4c00" }}>LAB</span>
        </span>
        <div className="nav-links-desktop" style={{ display:"flex", alignItems:"center", gap:40 }}>
          <a href="#how"     className="nav-link">How it works</a>
          <a href="#labs"    className="nav-link">Labs</a>
          <a href="#pricing" className="nav-link">Pricing</a>
          <button onClick={onLogin} className="nav-link">Sign in</button>
        </div>
        <button onClick={onRegister} className="nav-cta" style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:500, letterSpacing:"0.1em", textTransform:"uppercase", color:"#000", background:"#fff", border:"none", padding:"10px 24px", cursor:"pointer", transition:"background 0.2s,color 0.2s" }}
          onMouseEnter={e=>{e.target.style.background="#ff4c00";e.target.style.color="#fff";}} onMouseLeave={e=>{e.target.style.background="#fff";e.target.style.color="#000";}}>
          Start Free
        </button>
        <button className="nav-mobile-btn" onClick={() => setMobileMenu(o=>!o)}
          style={{ background:"none", border:"none", color:"#888", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, cursor:"pointer" }}>
          {mobileMenu ? "close" : "menu"}
        </button>
      </nav>

      {mobileMenu && (
        <div style={{ position:"fixed", top:64, left:0, right:0, zIndex:99, background:"#0a0a0a", borderBottom:"1px solid #2a2a2a", padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>
          <a href="#how"     onClick={()=>setMobileMenu(false)} className="nav-link">How it works</a>
          <a href="#labs"    onClick={()=>setMobileMenu(false)} className="nav-link">Labs</a>
          <a href="#pricing" onClick={()=>setMobileMenu(false)} className="nav-link">Pricing</a>
          <button onClick={()=>{setMobileMenu(false);onLogin?.();}} className="nav-link" style={{textAlign:"left"}}>Sign in</button>
          <button onClick={()=>{setMobileMenu(false);onRegister?.();}}
            style={{ background:"#fff", color:"#000", border:"none", padding:"12px 24px", fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:500, letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", marginTop:8 }}>
            Start Free
          </button>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ minHeight:"100vh", display:"grid", paddingTop:64 }} className="hero-grid" data-style="grid-template-columns:1fr 1fr">
        <style>{`.hero-grid{grid-template-columns:1fr 1fr}@media(max-width:900px){.hero-grid{grid-template-columns:1fr}}`}</style>

        {/* Left */}
        <div className="hero-left" style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"80px 48px 80px 80px", borderRight:"1px solid #2a2a2a" }}>
          <div className="fade-1 section-label">Production Alert · Live Incident</div>
          <h1 className="fade-2" style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(64px,7vw,110px)", lineHeight:0.9, letterSpacing:"0.02em", color:"#fff" }}>
            Your server<br />
            <span style={{ color:"#ff4c00", display:"block" }}>is down.</span>
            Fix it.
          </h1>
          <p className="fade-3" style={{ marginTop:32, fontSize:14, fontWeight:300, lineHeight:1.7, color:"#888", maxWidth:380 }}>
            Real production failures. Real terminals. Real skills.
            No simulations, no hand-holding — just you, the incident, and the fix.
          </p>
          <div className="fade-4" style={{ marginTop:48, display:"flex", alignItems:"center", gap:24, flexWrap:"wrap" }}>
            <button className="btn-primary" onClick={onRegister}>Start First Incident</button>
            <a href="#how" className="btn-ghost">How it works →</a>
          </div>
          <div className="fade-5" style={{ marginTop:64, display:"flex", alignItems:"center", gap:20 }}>
            <div style={{ display:"flex" }}>
              {["AS","MK","JL","RB"].map((initials, i) => (
                <div key={i} style={{ width:32, height:32, borderRadius:"50%", border:"2px solid #0a0a0a", background:["#1e3a5f","#3b1e1e","#1e3b2f","#3b2d1e"][i], marginLeft: i===0?0:-8, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#bbb" }}>
                  {initials}
                </div>
              ))}
            </div>
            <div style={{ fontSize:12, color:"#888", fontWeight:300 }}>
              Joined by <strong style={{ color:"#f0f0f0", fontWeight:500 }}>12,000+</strong> engineers from{" "}
              <strong style={{ color:"#f0f0f0", fontWeight:500 }}>120+</strong> countries
            </div>
          </div>
        </div>

        {/* Right — terminal interattivo */}
        <div className="hero-right" style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"80px 80px 80px 48px" }}>
          {variant === "C" && !heroReady ? (
            <div style={{ textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", color:"#555", fontSize:12 }}>
              connecting to prod-eu-west-1…
            </div>
          ) : (
            <div className="fade-term" style={{ position:"relative" }}>
              <div style={{ position:"absolute", top:-14, right:24, background:"#ff4c00", color:"#000", fontFamily:"'IBM Plex Mono',monospace", fontSize:9, fontWeight:600, letterSpacing:"0.2em", textTransform:"uppercase", padding:"5px 14px", zIndex:1 }}>
                ⚡ Live Incident
              </div>
              <FreeLabTerminal
                labId="nginx-port-conflict"
                onConvert={() => { track("free_lab_convert", { variant }); onRegister?.(); }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="section-how" style={{ borderTop:"1px solid #2a2a2a", padding:"120px 80px" }}>
        <div className="section-label">How it works</div>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(48px,5vw,80px)", letterSpacing:"0.02em", lineHeight:1, color:"#fff", marginBottom:80 }}>
          Three steps. <span style={{ color:"#555" }}>No fluff.</span>
        </h2>
        <div className="steps-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", border:"1px solid #2a2a2a" }}>
          {[
            { n:"01 — INCIDENT", icon:"⚡", title:"It drops.", desc:"A real production failure lands in your terminal. No context, no hints. Just an alert and a broken system. Exactly like the real thing." },
            { n:"02 — INVESTIGATE", icon:"🔎", title:"You dig.", desc:"Use real commands — journalctl, strace, netstat, df, top. Explore live logs, trace the failure, understand what actually broke." },
            { n:"03 — RESOLVE", icon:"✓", title:"You fix it.", desc:"Execute the right commands. The service comes back up. The incident closes. You leave knowing exactly what happened." },
          ].map((s, i) => (
            <div key={i} className="step">
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:"0.2em", color:"#555", marginBottom:32 }}>{s.n}</div>
              <div className="step-icon" style={{ width:48, height:48, border:"1px solid #333", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:28, color:"#ff4c00", fontSize:18, transition:"border-color 0.3s,background 0.3s" }}>{s.icon}</div>
              <h3 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, letterSpacing:"0.03em", color:"#fff", marginBottom:16 }}>{s.title}</h3>
              <p style={{ fontSize:13, lineHeight:1.7, color:"#888", fontWeight:300 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="stats-grid" style={{ borderTop:"1px solid #2a2a2a", display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
        {[
          { n:"12K+", l:"Incidents Solved" },
          { n:"6 min", l:"Avg Resolution Time" },
          { n:"87%",  l:"Complete First Lab" },
          { n:"24",   l:"Labs Available" },
        ].map(s => (
          <div key={s.l} className="stat-item">
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(48px,4vw,72px)", letterSpacing:"0.02em", color:"#fff", lineHeight:1, marginBottom:8 }}>{s.n}</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:"0.2em", textTransform:"uppercase", color:"#555" }}>{s.l}</div>
          </div>
        ))}
      </section>

      {/* ── LABS ── */}
      <section id="labs" className="section-labs" style={{ borderTop:"1px solid #2a2a2a", padding:"120px 80px" }}>
        <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", marginBottom:64, flexWrap:"wrap", gap:16 }}>
          <div>
            <div className="section-label">Practice Real Incidents</div>
            <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(48px,5vw,80px)", letterSpacing:"0.02em", lineHeight:1, color:"#fff" }}>
              Every lab is a<br /><span style={{ color:"#555" }}>real outage.</span>
            </h2>
          </div>
          <button onClick={() => document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"})}
            style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#888", textDecoration:"none", letterSpacing:"0.1em", textTransform:"uppercase", display:"flex", alignItems:"center", gap:8, transition:"color 0.2s", background:"none", border:"none", cursor:"pointer" }}>
            View All Labs →
          </button>
        </div>

        <div className="labs-grid" style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", border:"1px solid #2a2a2a" }}>
          {LABS.map((lab, i) => (
            <button
              key={i}
              className="lab-card"
              onClick={() => {
                if (lab.tier === "free" && lab.key) {
                  track("lab_open", { lab: lab.key });
                  setActiveLab(lab.key);
                } else {
                  document.getElementById("pricing")?.scrollIntoView({behavior:"smooth"});
                }
              }}
              style={{ textAlign:"left", border:"none", borderRight: i < LABS.length-1 ? "1px solid #2a2a2a" : "none" }}
            >
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:"0.2em", textTransform:"uppercase", padding:"4px 8px", width:"fit-content", marginBottom:24,
                color: lab.tier==="free" ? "#22c55e" : "#ff4c00",
                border: lab.tier==="free" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,76,0,0.3)",
                background: lab.tier==="free" ? "rgba(34,197,94,0.08)" : "rgba(255,76,0,0.15)",
              }}>
                {lab.tier === "free" ? "Free" : "Pro"}
              </div>
              <div style={{ fontSize:20, marginBottom:16, filter:"grayscale(1) brightness(0.6)", transition:"filter 0.25s" }}>{lab.icon}</div>
              <h3 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:26, letterSpacing:"0.03em", color:"#fff", marginBottom:12, lineHeight:1.1 }}>{lab.name}</h3>
              <p style={{ fontSize:12, lineHeight:1.6, color:"#888", fontWeight:300, flex:1 }}>{lab.desc}</p>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:24, paddingTop:20, borderTop:"1px solid #2a2a2a" }}>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#555" }}>⏱ {lab.time}</span>
                <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#555" }}>
                  <span style={{ color:"#eab308" }}>★</span> {lab.rating}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── QUOTE + STATS ── */}
      <section className="section-quote quote-grid" style={{ borderTop:"1px solid #2a2a2a", padding:"120px 80px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:80, alignItems:"center" }}>
        <div>
          <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:160, lineHeight:0.8, color:"#2a2a2a", marginBottom:16, letterSpacing:"-0.05em" }}>"</div>
          <p style={{ fontFamily:"'IBM Plex Sans',sans-serif", fontSize:"clamp(20px,2vw,28px)", fontWeight:300, lineHeight:1.5, color:"#fff" }}>
            WinLab is the closest thing to real production experience you can get. It changed how I troubleshoot.
          </p>
          <div style={{ marginTop:40, display:"flex", alignItems:"center", gap:20 }}>
            <div style={{ width:48, height:48, borderRadius:"50%", background:"#1a1a1a", border:"1px solid #333", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'IBM Plex Mono',monospace", fontSize:14, color:"#bbb" }}>AS</div>
            <div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:12, fontWeight:500, color:"#f0f0f0", marginBottom:4 }}>Arjun S.</div>
              <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#888", letterSpacing:"0.05em" }}>SRE at Stripe</div>
            </div>
          </div>
        </div>
        <div>
          {[
            { l:"Engineers trained", v:"12K+" },
            { l:"Countries",         v:"120+" },
            { l:"Labs available",    v:"24" },
            { l:"Avg rating",        v:"4.8 ★" },
          ].map(s => (
            <div key={s.l} className="quote-stat-row">
              <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#888", letterSpacing:"0.1em", textTransform:"uppercase" }}>{s.l}</span>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:40, color:"#fff", letterSpacing:"0.02em" }}>{s.v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ borderTop:"1px solid #2a2a2a", padding:"120px 80px" }}>
        <div className="section-label">Pricing</div>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(48px,5vw,80px)", letterSpacing:"0.02em", lineHeight:1, color:"#fff", marginBottom:64 }}>
          Simple. <span style={{ color:"#555" }}>No tricks.</span>
        </h2>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:0, border:"1px solid #2a2a2a", maxWidth:800 }}>
          <div style={{ padding:48, borderRight:"1px solid #2a2a2a" }}>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#555", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:8 }}>Free</div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:64, color:"#fff", lineHeight:1, marginBottom:8 }}>$0</div>
            <div style={{ fontSize:13, color:"#888", fontWeight:300, marginBottom:32 }}>No credit card. No expiry.</div>
            <ul style={{ listStyle:"none", padding:0, display:"flex", flexDirection:"column", gap:12, marginBottom:40 }}>
              {["6 free labs","Real terminal environment","Incident history","Community access"].map(f => (
                <li key={f} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, color:"#888", fontWeight:300 }}>
                  <span style={{ color:"#22c55e", fontFamily:"'IBM Plex Mono',monospace" }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={onRegister} className="btn-primary">Start free</button>
          </div>
          <div style={{ padding:48, position:"relative" }}>
            <div style={{ position:"absolute", top:20, right:20, fontFamily:"'IBM Plex Mono',monospace", fontSize:9, color:"#ff4c00", background:"rgba(255,76,0,0.1)", border:"1px solid rgba(255,76,0,0.3)", padding:"4px 10px", letterSpacing:"0.15em", textTransform:"uppercase" }}>early price</div>
            <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#555", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:8 }}>Pro</div>
            <div style={{ display:"flex", alignItems:"baseline", gap:4, marginBottom:8 }}>
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:64, color:"#fff", lineHeight:1 }}>$5</span>
              <span style={{ color:"#888", fontSize:14 }}>/mo</span>
            </div>
            <div style={{ fontSize:13, color:"#888", fontWeight:300, marginBottom:32 }}>Locked forever at this price.</div>
            <ul style={{ listStyle:"none", padding:0, display:"flex", flexDirection:"column", gap:12, marginBottom:40 }}>
              {["All 24 labs","AI Mentor","Certificates","New incidents monthly","Everything in free"].map(f => (
                <li key={f} style={{ display:"flex", alignItems:"center", gap:10, fontSize:13, color:"#888", fontWeight:300 }}>
                  <span style={{ color:"#22c55e", fontFamily:"'IBM Plex Mono',monospace" }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <button onClick={() => doCheckout("early")} className="btn-primary">Unlock all 24 labs — $5/mo</button>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ borderTop:"1px solid #2a2a2a", padding:"120px 80px", display:"flex", flexDirection:"column", alignItems:"center", textAlign:"center", position:"relative", overflow:"hidden" }} className="section-cta">
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 60% 50% at 50% 100%,rgba(255,76,0,0.06) 0%,transparent 70%)", pointerEvents:"none" }} />
        <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, letterSpacing:"0.3em", textTransform:"uppercase", color:"#ff4c00", marginBottom:24 }}>Ready to level up?</div>
        <h2 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"clamp(56px,6vw,96px)", letterSpacing:"0.02em", lineHeight:0.95, color:"#fff", marginBottom:24 }}>
          Start your first<br />incident now.
        </h2>
        <p style={{ fontSize:14, color:"#888", fontWeight:300, marginBottom:56 }}>No credit card. No setup. No simulations.</p>
        <div style={{ display:"flex", alignItems:"center", gap:32, flexWrap:"wrap", justifyContent:"center" }}>
          <button className="btn-large" onClick={onRegister}>Start First Incident</button>
          <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:11, color:"#555" }}>Free forever on six labs.</span>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer-grid" style={{ borderTop:"1px solid #2a2a2a", padding:"64px 80px", display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr" }}>
        <div>
          <div style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:16, fontWeight:600, color:"#fff", marginBottom:16 }}>WIN<span style={{ color:"#ff4c00" }}>LAB</span></div>
          <p style={{ fontSize:12, color:"#555", lineHeight:1.6, marginBottom:32, fontWeight:300 }}>Real incidents.<br />Real skills.<br />© 2025 WinLab.</p>
          <div style={{ display:"flex", gap:12 }}>
            {["tw","gh","dc"].map(s => (
              <a key={s} href="#" style={{ width:32, height:32, border:"1px solid #333", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#888", textDecoration:"none" }}>{s}</a>
            ))}
          </div>
        </div>
        {[
          { h:"Product",   links:[{l:"How it works",href:"#how"},{l:"Labs",href:"#labs"},{l:"Pricing",href:"#pricing"}] },
          { h:"Legal",     links:[{l:"Privacy",href:"/privacy"},{l:"Terms",href:"/legal"},{l:"Security",href:"/legal"}] },
          { h:"Support",   links:[{l:"Contact",href:"mailto:support@winlab.cloud"},{l:"Status",href:"#"}] },
        ].map(col => (
          <div key={col.h}>
            <h4 style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:9, letterSpacing:"0.25em", textTransform:"uppercase", color:"#555", marginBottom:20 }}>{col.h}</h4>
            <ul style={{ listStyle:"none", padding:0, display:"flex", flexDirection:"column", gap:12 }}>
              {col.links.map(lk => (
                <li key={lk.l}><a href={lk.href} style={{ fontSize:12, color:"#888", textDecoration:"none", fontWeight:300, transition:"color 0.2s" }}>{lk.l}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </footer>
      <div className="footer-bottom" style={{ borderTop:"1px solid #2a2a2a", padding:"20px 80px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#555" }}>WIN<span style={{ color:"#ff4c00" }}>LAB</span> — Real incidents. Real skills.</span>
        <span style={{ fontFamily:"'IBM Plex Mono',monospace", fontSize:10, color:"#555" }}>Designed for engineers who ship at 3am.</span>
      </div>

      {/* ── MODALS ── */}
      {activeLab && !showSignup && (
        <LabModal scenarioKey={activeLab} onSuccess={handleSuccess} onClose={() => setActiveLab(null)} />
      )}
      {showSignup && (
        <SignupModal variant={variant} onLogin={onLogin} onRegister={onRegister} onSkip={() => setShowSignup(false)} />
      )}
      <CookieBanner />
    </div>
  );
}
