import { useState, useEffect, useRef } from 'react';
import {
  Server, LayoutDashboard, User, LogOut,
  Search, Clock, AlertCircle, X
} from 'lucide-react';
import LabTerminal from './components/LabTerminal';
import RegisterModal from './components/RegisterModal';
import CookieBanner from './CookieBanner';
import AIMentor from './AIMentor';

const STARTER_IDS = new Set(['linux-terminal','enhanced-terminal','disk-full','nginx-port-conflict']);

const labDatabase = [
  { id:'linux-terminal',          tier:'Starter', title:'Linux Terminal Basics',         difficulty:'Easy',   duration:'15m', xp:150,  tags:['linux','bash'],       category:'Starter' },
  { id:'enhanced-terminal',       tier:'Starter', title:'Guided Lab: 3 Incidents',       difficulty:'Easy',   duration:'20m', xp:200,  tags:['apache','disk'],      category:'Starter' },
  { id:'disk-full',               tier:'Starter', title:'Disk Full — Emergency',         difficulty:'Easy',   duration:'8m',  xp:100,  tags:['disk','storage'],     category:'Starter' },
  { id:'nginx-port-conflict',     tier:'Starter', title:'Nginx Port Conflict',           difficulty:'Easy',   duration:'6m',  xp:100,  tags:['nginx','port'],       category:'Starter' },
  { id:'permission-denied',       tier:'Pro',     title:'Permission Denied — ACL',       difficulty:'Medium', duration:'10m', xp:300,  tags:['chmod','selinux'],    category:'Pro'     },
  { id:'raid-simulator',          tier:'Pro',     title:'RAID Configuration',            difficulty:'Medium', duration:'20m', xp:500,  tags:['raid','mdadm'],       category:'Pro'     },
  { id:'memory-leak',             tier:'Pro',     title:'Memory Leak: NodeJS',           difficulty:'Hard',   duration:'15m', xp:800,  tags:['memory','nodejs'],    category:'Pro'     },
  { id:'db-dead',                 tier:'Pro',     title:'Unreachable Database',          difficulty:'Hard',   duration:'20m', xp:850,  tags:['mysql','recovery'],   category:'Pro'     },
  { id:'sssd-ldap',               tier:'Pro',     title:'SSSD / LDAP Failure',           difficulty:'Hard',   duration:'25m', xp:1200, tags:['ldap','auth'],        category:'Pro'     },
  { id:'advanced-scenarios',      tier:'Pro',     title:'Advanced Production Scenarios', difficulty:'Hard',   duration:'20m', xp:1500, tags:['ssl','oom','java'],   category:'Pro'     },
  { id:'real-server',             tier:'Pro',     title:'Real Server: 12 Scenarios',     difficulty:'Hard',   duration:'25m', xp:2000, tags:['iostat','tcpdump'],   category:'Pro'     },
  { id:'api-timeout-n-plus-one',  tier:'Codex',   title:'API Timeout: N+1 Query',        difficulty:'Hard',   duration:'15m', xp:700,  tags:['sql','api'],          category:'Codex'   },
  { id:'auth-bypass-jwt-trust',   tier:'Codex',   title:'Auth Bypass: JWT Trust',        difficulty:'Hard',   duration:'12m', xp:600,  tags:['security','jwt'],     category:'Codex'   },
  { id:'stripe-webhook-forgery',  tier:'Codex',   title:'Stripe Webhook Forgery',        difficulty:'Hard',   duration:'18m', xp:750,  tags:['security','webhook'], category:'Codex'   },
  { id:'deploy-new-version',      tier:'Ops',     title:'Deploy New Version',            difficulty:'Medium', duration:'5m',  xp:200,  tags:['production'],         category:'Ops'     },
  { id:'rollback-failed-deploy',  tier:'Ops',     title:'Rollback Strategy',             difficulty:'Medium', duration:'8m',  xp:250,  tags:['git','cicd'],         category:'Ops'     },
  { id:'ghost-asset-incident',    tier:'Ops',     title:'The 70-Hour Bug',               difficulty:'Hard',   duration:'40m', xp:1500, tags:['debugging'],          category:'Ops'     },
  { id:'k8s-crashloop',           tier:'Ops',     title:'Kubernetes CrashLoop',          difficulty:'Hard',   duration:'15m', xp:900,  tags:['k8s','docker'],       category:'Ops'     },
  { id:'redis-oom',               tier:'Ops',     title:'Redis OOM Storm',               difficulty:'Hard',   duration:'12m', xp:700,  tags:['redis','cache'],      category:'Ops'     },
  { id:'network-lab',             tier:'Business',title:'Network Simulator',             difficulty:'Medium', duration:'30m', xp:0,    tags:['network'],            category:'Business', status:'placeholder' },
];

const CATEGORIES = ['All','Starter','Pro','Codex','Ops','Business'];

const INITIAL_LOGS = [
  { type:'system',  text:'WINLAB INCIDENT ROUTER [v4.2.0]' },
  { type:'info',    text:'Booting secure environment...' },
  { type:'info',    text:'Initializing neural link to edge nodes...' },
  { type:'success', text:'Link established. Latency: 14ms' },
  { type:'warning', text:'SCAN COMPLETE: 34 critical incidents detected.' },
  { type:'info',    text:'Waiting for Operator authorization...' },
  { type:'prompt',  text:'Type "login" or "1" to continue:' },
];

const FOOTER_LINKS = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Labs',         href: '/'             },
      { label: 'Pricing',      href: '/pricing'      },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy',  href: '/privacy'  },
      { label: 'Terms',    href: '/terms'    },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Status',  href: '/status'  },
    ],
  },
];

export default function HomeShell() {
  const [view, setView] = useState('terminal');
  const [auth, setAuth] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [selectedLab, setSelectedLab] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (view !== 'terminal') return;
    let i = 0;
    const iv = setInterval(() => {
      if (i < INITIAL_LOGS.length) {
        setTerminalLogs(prev => [...prev, INITIAL_LOGS[i++]]);
      } else {
        clearInterval(iv);
      }
    }, 300);
    return () => clearInterval(iv);
  }, [view]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  useEffect(() => {
    const stored = sessionStorage.getItem('winlab_auth');
    if (stored) {
      try { setAuth(JSON.parse(stored)); } catch {}
    }
  }, []);

  function handleCommand(e) {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const cmd = inputValue.toLowerCase().trim();
    setTerminalLogs(prev => [...prev, { type:'user', text:`> ${inputValue}` }]);
    setInputValue('');
    setTimeout(() => {
      if (cmd === 'login' || cmd === 'start' || cmd === '1') {
        setTerminalLogs(prev => [...prev, { type:'info', text:'Access authorized. Redirecting...' }]);
        setTimeout(() => setView('dashboard'), 600);
      } else if (cmd === 'help') {
        setTerminalLogs(prev => [...prev, { type:'system', text:'Commands: login, help, clear' }]);
      } else if (cmd === 'clear') {
        setTerminalLogs([{ type:'prompt', text:'Type "login" or "1" to continue:' }]);
      } else {
        setTerminalLogs(prev => [...prev, { type:'error', text:`Unrecognized command: ${cmd}` }]);
      }
    }, 150);
  }

  async function startLab(lab) {
    if (lab.status === 'placeholder') return;
    const needsAuth = !STARTER_IDS.has(lab.id);
    if (needsAuth && !auth) {
      setSelectedLab(lab);
      setShowRegister(true);
      return;
    }
    setSelectedLab(lab);
    setLabLoading(true);
    setLabError('');
    try {
      const res = await fetch('/api/lab/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ labId: lab.id, sessionId: crypto.randomUUID() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) { setShowRegister(true); return; }
        setLabError(data.error || 'Unable to start the lab.');
        return;
      }
      setActiveSession({ sessionId: data.sessionId, containerName: data.containerName, labId: lab.id });
      setView('lab');
    } catch {
      setLabError('Server connection failed.');
    } finally {
      setLabLoading(false);
    }
  }

  async function stopLab() {
    if (activeSession) {
      await fetch('/api/lab/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId: activeSession.sessionId }),
      }).catch(() => {});
    }
    setActiveSession(null);
    setSelectedLab(null);
    setView('dashboard');
  }

  function handleLabComplete() {
    if (selectedLab && !STARTER_IDS.has(selectedLab.id)) {
      setShowPaywall(true);
    } else {
      stopLab();
    }
  }

  function handleAuthSuccess(user) {
    setAuth(user);
    sessionStorage.setItem('winlab_auth', JSON.stringify(user));
    setShowRegister(false);
    if (selectedLab) startLab(selectedLab);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method:'POST', credentials:'include' }).catch(()=>{});
    setAuth(null);
    sessionStorage.removeItem('winlab_auth');
    setView('terminal');
    setTerminalLogs([]);
  }

  async function handleUpgrade() {
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan: 'pro' }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
  }

  const filteredLabs = labDatabase.filter(lab => {
    const matchCat = selectedCategory === 'All' || lab.category === selectedCategory;
    const matchSearch = lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  // ── Terminal landing view ──────────────────────────────────────────────────
  if (view === 'terminal') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 font-mono">
        <CookieBanner />
        <div className="w-full max-w-4xl h-[85vh] bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-zinc-900 px-4 py-2 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40 border border-red-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40 border border-yellow-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40 border border-green-500/50" />
            </div>
            <span className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">WinLab Operational Terminal</span>
            <div className="w-10" />
          </div>
          <div className="flex-1 p-6 overflow-y-auto space-y-1">
            {terminalLogs.map((log, i) => log && (
              <div key={i} className={`text-sm leading-relaxed break-all ${
                log.type==='system'  ? 'text-blue-400 font-bold' :
                log.type==='error'   ? 'text-red-500 font-bold' :
                log.type==='success' ? 'text-green-500' :
                log.type==='warning' ? 'text-yellow-500' :
                log.type==='user'    ? 'text-white' : 'text-gray-500'
              }`}>{log.text}</div>
            ))}
            <div ref={terminalEndRef} />
          </div>
          <form onSubmit={handleCommand} className="bg-zinc-900/50 p-6 border-t border-white/5 flex items-center gap-3 shrink-0">
            <span className="text-red-500 font-bold">OP@WINLAB:~$</span>
            <input
              autoFocus
              className="flex-1 bg-transparent border-none outline-none text-white text-sm"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Run command..."
            />
          </form>
        </div>
      </div>
    );
  }

  // ── Lab terminal view ──────────────────────────────────────────────────────
  if (view === 'lab' && activeSession) {
    return (
      <div className="flex h-screen bg-[#050505] text-gray-300 font-sans overflow-hidden">
        {showRegister && <RegisterModal onSuccess={handleAuthSuccess} onClose={() => setShowRegister(false)} />}
        {showPaywall && <PaywallModal onUpgrade={handleUpgrade} onClose={() => { setShowPaywall(false); stopLab(); }} />}
        <div className="flex-1 flex flex-col">
          <LabTerminal
            containerName={activeSession.containerName}
            onClose={stopLab}
            onComplete={handleLabComplete}
          />
        </div>
        <AIMentor labId={activeSession.labId} labState={{}} />
      </div>
    );
  }

  // ── Dashboard view ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#050505] text-gray-300 font-sans overflow-hidden">
      <CookieBanner />
      {showRegister && <RegisterModal onSuccess={handleAuthSuccess} onClose={() => setShowRegister(false)} />}
      {showPaywall && <PaywallModal onUpgrade={handleUpgrade} onClose={() => setShowPaywall(false)} />}

      <aside className={`fixed lg:relative z-50 w-64 h-full border-r border-white/5 bg-black flex flex-col transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5 shrink-0">
          <div className="w-8 h-8 bg-red-600 flex items-center justify-center rounded">
            <Server className="w-5 h-5 text-white" />
          </div>
          <span className="font-black tracking-tighter text-xl text-white italic">WINLAB</span>
        </div>
        <nav className="flex-1 p-4 space-y-2 mt-4 overflow-y-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab==='dashboard' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'hover:bg-white/5 text-gray-500'}`}
          >
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </button>
          <button
            onClick={() => auth ? setActiveTab('profile') : setShowRegister(true)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab==='profile' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'hover:bg-white/5 text-gray-500'}`}
          >
            <User className="w-5 h-5" />
            {auth ? (auth.name || auth.email) : 'Sign In'}
          </button>
        </nav>
        <div className="p-4 border-t border-white/5 shrink-0">
          {auth ? (
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] uppercase font-black tracking-widest text-gray-600 hover:text-red-500 transition-colors">
              <LogOut className="w-4 h-4" /> Terminate Session
            </button>
          ) : (
            <button onClick={() => setShowRegister(true)} className="w-full flex items-center gap-3 px-4 py-2 text-[10px] uppercase font-black tracking-widest text-gray-600 hover:text-red-500 transition-colors">
              Sign Up / Sign In
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto p-4 md:p-10">
        <div className="max-w-6xl mx-auto">
          <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">Operational Hub</h1>
              <p className="text-gray-500 text-sm font-medium mt-2">
                Operator: <span className="text-white">{auth ? (auth.name || auth.email) : 'Guest'}</span>
                {' '}— Status: <span className="text-red-500 font-bold">ACTIVE</span>
              </p>
            </div>
            <div className="bg-zinc-900 border border-white/5 px-6 py-3 rounded-2xl">
              <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Catalog Integrity</p>
              <p className="text-xl font-black text-white">{filteredLabs.length} / {labDatabase.length} MODULES</p>
            </div>
          </header>

          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex gap-1 bg-zinc-900 p-1.5 rounded-2xl border border-white/5 overflow-x-auto w-full md:w-auto no-scrollbar">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${selectedCategory===cat ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <input
                type="text"
                placeholder="Search labs..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-900 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-red-500/30"
              />
            </div>
          </div>

          {labError && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-mono">
              {labError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-20">
            {filteredLabs.map(lab => (
              <div
                key={lab.id}
                onClick={() => !labLoading && lab.status !== 'placeholder' && setSelectedLab(lab)}
                className={`group relative p-6 rounded-[32px] border flex flex-col transition-all duration-300 ${lab.status==='placeholder' ? 'bg-zinc-950/30 border-white/5 grayscale opacity-40 cursor-not-allowed' : 'bg-zinc-950 border-white/10 hover:border-red-600/40 cursor-pointer hover:shadow-2xl hover:shadow-red-900/10 hover:-translate-y-1'}`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className={`px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${lab.difficulty==='Easy' ? 'text-green-500 border-green-500/10 bg-green-500/5' : lab.difficulty==='Medium' ? 'text-blue-500 border-blue-500/10 bg-blue-500/5' : 'text-red-500 border-red-500/10 bg-red-500/5'}`}>
                    {lab.difficulty}
                  </div>
                  <div className="text-[9px] font-mono text-gray-700 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {lab.duration}
                  </div>
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight italic mb-3 group-hover:text-red-500 transition-colors leading-tight min-h-[3rem]">{lab.title}</h3>
                <div className="flex flex-wrap gap-1 mb-6 flex-grow">
                  {lab.tags?.map(tag => (
                    <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[8px] font-mono text-gray-500">#{tag}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-5 border-t border-white/5 mt-auto">
                  <span className="text-[9px] font-black uppercase text-gray-600 tracking-widest">{lab.category}</span>
                  <span className="text-xs font-black text-red-500 italic">+{lab.xp} XP</span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <footer className="border-t border-white/5 pt-12 pb-10">
            <div className="flex flex-col md:flex-row justify-between gap-10">
              <div className="shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded">
                    <Server className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-black tracking-tighter text-white italic">WINLAB</span>
                </div>
                <p className="text-[11px] text-gray-600 max-w-[180px] leading-relaxed">
                  Real-world IT incident labs. Learn by breaking things.
                </p>
              </div>
              <div className="flex gap-16">
                {FOOTER_LINKS.map(col => (
                  <div key={col.heading}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-3">{col.heading}</p>
                    <ul className="space-y-2">
                      {col.links.map(link => (
                        <li key={link.label}>
                          <a
                            href={link.href}
                            className="text-xs text-gray-600 hover:text-white transition-colors"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-gray-700 mt-10">
              © {new Date().getFullYear()} WinLab. All rights reserved.
            </p>
          </footer>
        </div>
      </main>

      {selectedLab && view !== 'lab' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" onClick={() => setSelectedLab(null)} />
          <div className="relative bg-zinc-900 border border-white/10 rounded-[40px] w-full max-w-2xl p-8 md:p-12 shadow-2xl">
            <div className="text-center">
              <div className="inline-flex p-4 rounded-full bg-red-600/10 border border-red-600/20 mb-8">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter mb-4 leading-tight">{selectedLab.title}</h2>
              <p className="text-gray-500 mb-10 max-w-md mx-auto italic">
                Initializing isolated Docker environment. Confirm launch?
              </p>
              <div className="grid grid-cols-2 gap-4 md:gap-8 mb-10">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[10px] font-black text-gray-600 uppercase mb-1">XP Reward</p>
                  <p className="text-xl font-black text-red-500 italic">+{selectedLab.xp} XP</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center">
                  <p className="text-[10px] font-black text-gray-600 uppercase mb-1">Time Limit</p>
                  <p className="text-xl font-black text-white italic">{selectedLab.duration}</p>
                </div>
              </div>
              {labError && <p className="mb-4 text-red-400 text-sm font-mono">{labError}</p>}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => startLab(selectedLab)}
                  disabled={labLoading}
                  className="flex-1 py-5 bg-red-600 text-white font-black rounded-3xl uppercase tracking-widest italic hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 active:scale-95 disabled:opacity-50"
                >
                  {labLoading ? 'LAUNCHING...' : 'LAUNCH SESSION'}
                </button>
                <button onClick={() => { setSelectedLab(null); setLabError(''); }} className="flex-1 py-5 border border-white/10 text-gray-500 font-black rounded-3xl uppercase tracking-widest hover:bg-white/5 transition-all">
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PaywallModal({ onUpgrade, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-white/10 rounded-[32px] w-full max-w-md p-8 text-center shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 hover:text-white"><X className="w-5 h-5" /></button>
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-2xl font-black text-white italic uppercase mb-2">Lab Complete!</h2>
        <p className="text-gray-500 text-sm mb-8">Unlock all 34 labs, unlimited AI Mentor, and certificates.</p>
        <div className="bg-white/5 rounded-2xl p-4 mb-8 border border-white/5">
          <p className="text-[10px] text-gray-600 uppercase font-black mb-1">Pro Plan</p>
          <p className="text-3xl font-black text-white">$19<span className="text-gray-500 text-sm font-normal">/mo</span></p>
        </div>
        <button
          onClick={onUpgrade}
          className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest italic rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-600/20"
        >
          UNLOCK EVERYTHING →
        </button>
        <button onClick={onClose} className="mt-3 w-full text-xs text-gray-600 hover:text-gray-400 transition-colors">
          Continue for free
        </button>
      </div>
    </div>
  );
}
