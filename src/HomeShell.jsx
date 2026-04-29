import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  Server, LayoutDashboard, User, LogOut,
  Search, Clock, AlertCircle, X
} from 'lucide-react';
import SocialSidebar from './SocialSidebar';
import { LEVEL_OPTIONS, getLevelConfig } from './config/levels';
import { useSocialStorage } from './hooks/useSocialStorage';

const LabTerminal = lazy(() => import('./components/LabTerminal'));
const LabBootSplash = lazy(() => import('./components/LabBootSplash'));
const RegisterModal = lazy(() => import('./components/RegisterModal'));
const CookieBanner = lazy(() => import('./CookieBanner'));
const AIMentor = lazy(() => import('./AIMentor'));



const CATEGORIES = ['All','Starter','Pro','Codex','Ops','Business'];

function buildInitialLogs() {
  return [
    { type:'system',  text:'WINLAB INCIDENT ROUTER [v4.2.0]' },
    { type:'info',    text:'Booting secure environment...' },
    { type:'info',    text:'Initializing neural link to edge nodes...' },
    { type:'success', text:'Link established. Latency: 14ms' },
    { type:'warning', text:'SCAN COMPLETE: runnable incidents detected.' },
    { type:'info',    text:'Waiting for Operator authorization...' },
    { type:'prompt',  text:'Type "login" or "1" to continue:' },
  ];
}

const FOOTER_LINKS = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Labs',         href: '/'             },
      { label: 'Blog',         href: '/blog'         },
      { label: 'Pricing',      href: '#pricing'      },
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
      { label: 'Contact',  href: '/contact'  },
      { label: 'Feedback', href: '/feedback' },
      { label: 'Profile',  href: '/profile'  },
      { label: 'Status',   href: '/status'   },
    ],
  },
];

const QUICK_PAGE_LINKS = [
  { label: 'Blog', href: '/blog' },
  { label: 'Feedback', href: '/feedback' },
  { label: 'Profile', href: '/profile' },
  { label: 'Contact', href: '/contact' },
  { label: 'Status', href: '/status' },
  { label: 'How It Works', href: '/how-it-works' },
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
  const [showSplash, setShowSplash] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [labCatalog, setLabCatalog] = useState([]);
  const [starterIds, setStarterIds] = useState(new Set());
  const [selectedLevelId, setSelectedLevelId] = useState('JUNIOR');
  const [pendingCheckoutPlan, setPendingCheckoutPlan] = useState(null);
  const [earlyAccessRemaining, setEarlyAccessRemaining] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [socialLinks] = useSocialStorage();
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (terminalLogs.length === 0) {
      setTerminalLogs(buildInitialLogs());
    }
  }, [terminalLogs.length]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  useEffect(() => {
    const stored = sessionStorage.getItem('winlab_auth');
    if (stored) {
      try { setAuth(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const res = await fetch('/api/labs/catalog', { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok || !Array.isArray(data.labs)) return;
        if (cancelled) return;
        setLabCatalog(data.labs);
        setStarterIds(new Set(Array.isArray(data.starterIds) ? data.starterIds : []));
      } catch {
        setLabCatalog([]);
        setStarterIds(new Set());
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEarlyAccessSeats() {
      try {
        const res = await fetch('/api/early-access/seats', { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || cancelled) return;
        setEarlyAccessRemaining(
          Number.isFinite(data.remaining) ? data.remaining : null
        );
      } catch {}
    }

    loadEarlyAccessSeats();
    return () => { cancelled = true; };
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
    const needsAuth = !starterIds.has(lab.id);
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
        body: JSON.stringify({
          labId: lab.id,
          level: selectedLevelId,
          sessionId: (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`),
        }),
      });
      if (res.status === 401) { setShowRegister(true); return; }
      let data;
      try {
        data = await res.json();
      } catch {
        const text = await res.text().catch(() => '');
        setLabError(`Server error ${res.status}: ${text.slice(0, 120) || 'unexpected response'}`);
        return;
      }
      if (!res.ok) {
        setLabError(data.error || `Error ${res.status}`);
        return;
      }
      setActiveSession({
        sessionId: data.sessionId,
        containerName: data.containerName,
        labId: lab.id,
        levelId: data.level || selectedLevelId,
        hintEnabled: data.hintEnabled !== false,
        lab: selectedLab || lab,
        bootSequence: data.bootSequence ?? [],
      });
      setShowSplash((data.bootSequence?.length ?? 0) > 0);
      setView('lab');
    } catch (err) {
      setLabError(`Network error: ${err?.message || 'check console'}`);
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
    setShowSplash(false);
    setActiveSession(null);
    setSelectedLab(null);
    setView('dashboard');
  }

  function handleLabComplete() {
    if (selectedLab && !starterIds.has(selectedLab.id)) {
      setShowPaywall(true);
    } else {
      stopLab();
    }
  }

  function handleAuthSuccess(user) {
    setAuth(user);
    sessionStorage.setItem('winlab_auth', JSON.stringify(user));
    setShowRegister(false);
    if (pendingCheckoutPlan) {
      const plan = pendingCheckoutPlan;
      setPendingCheckoutPlan(null);
      startCheckout(plan);
      return;
    }
    if (selectedLab) startLab(selectedLab);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method:'POST', credentials:'include' }).catch(()=>{});
    setAuth(null);
    sessionStorage.removeItem('winlab_auth');
    setView('terminal');
    setTerminalLogs(buildInitialLogs());
  }

  async function startCheckout(plan) {
    if (!plan) return;
    if (!auth) {
      setPendingCheckoutPlan(plan);
      setShowRegister(true);
      return;
    }
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setLabError(data?.error || `Checkout error ${res.status}`);
        return;
      }
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      setLabError(`Checkout error: ${err?.message || 'unable to start Stripe checkout'}`);
    }
  }

  async function handleUpgrade(plan = 'pro') {
    await startCheckout(plan);
  }

  const filteredLabs = labCatalog.filter(lab => {
    const matchCat = selectedCategory === 'All' || lab.category === selectedCategory;
    const matchSearch = lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });
  const starterLabs = labCatalog.filter(lab => starterIds.has(lab.id));
  const featuredStarterLabs = starterLabs.slice(0, 5);

  // ── Terminal landing view ──────────────────────────────────────────────────
  if (view === 'terminal') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 font-mono">
        <Suspense fallback={null}>
          <CookieBanner />
        </Suspense>
        <SocialSidebar links={socialLinks} />
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
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-cyan-400/10 bg-cyan-400/5 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-cyan-200/80">
              <div className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
              {catalogLoading ? 'syncing lab catalog' : `${starterLabs.length} starter labs primed`}
            </div>
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

  if (view === 'lab' && showSplash && activeSession?.bootSequence?.length > 0) {
    return (
      <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#050505] text-xs font-mono uppercase tracking-[0.28em] text-slate-500"><div className="animate-pulse">booting lab shell</div></div>}>
        <LabBootSplash
          lab={activeSession.lab}
          levelId={activeSession.levelId}
          hintEnabled={activeSession.hintEnabled}
          bootSequence={activeSession.bootSequence}
          onReady={() => setShowSplash(false)}
        />
      </Suspense>
    );
  }

  // ── Lab terminal view ──────────────────────────────────────────────────────
  if (view === 'lab' && activeSession) {
    return (
      <div className="flex h-screen bg-[#050505] text-gray-300 font-sans overflow-hidden">
        {showRegister && <Suspense fallback={null}><RegisterModal onSuccess={handleAuthSuccess} onClose={() => setShowRegister(false)} /></Suspense>}
        {showPaywall && <PaywallModal onUpgrade={handleUpgrade} onClose={() => { setShowPaywall(false); stopLab(); }} />}
        <SocialSidebar links={socialLinks} />
        <div className="flex-1 flex flex-col">
          <Suspense fallback={<div className="flex h-full items-center justify-center text-xs font-mono uppercase tracking-[0.28em] text-slate-500"><div className="animate-pulse">attaching live terminal</div></div>}>
            <LabTerminal
              containerName={activeSession.containerName}
              levelId={activeSession.levelId}
              hintEnabled={activeSession.hintEnabled}
              onClose={stopLab}
              onComplete={handleLabComplete}
            />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <AIMentor labId={activeSession.labId} labState={{}} />
        </Suspense>
      </div>
    );
  }

  // ── Dashboard view ─────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[#050505] text-gray-300 font-sans overflow-hidden">
      <Suspense fallback={null}>
        <CookieBanner />
      </Suspense>
      <SocialSidebar links={socialLinks} />
      {showRegister && <Suspense fallback={null}><RegisterModal onSuccess={handleAuthSuccess} onClose={() => setShowRegister(false)} /></Suspense>}
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
          <div className="mt-6 border-t border-white/5 pt-4">
            <p className="mb-3 px-4 text-[9px] font-black uppercase tracking-[0.28em] text-gray-600">Pages</p>
            <div className="space-y-1">
              {QUICK_PAGE_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block rounded-xl px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 transition-colors hover:bg-white/5 hover:text-white"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
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
              <p className="text-xl font-black text-white">{filteredLabs.length} / {labCatalog.length} MODULES</p>
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


          <section className="mb-10 rounded-[32px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(180deg,rgba(10,18,16,0.96),rgba(5,5,5,0.98))] p-6 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
              <div className="max-w-2xl">
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-emerald-300/80 mb-3">Start In The Free Zone</p>
                <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tighter leading-none mb-3">
                  Let The First 5 Free Labs Drive The Homepage
                </h2>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Get people into real incidents immediately with the free starter labs, then introduce pricing as the next step.
                  Keep the catalog at the center of the homepage, not the paywall.
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 shrink-0">
                {featuredStarterLabs.map(lab => (
                  <button
                    key={lab.id}
                    onClick={() => !labLoading && setSelectedLab(lab)}
                    className="min-w-[150px] rounded-2xl border border-emerald-400/15 bg-black/35 px-4 py-4 text-left transition-all hover:border-emerald-300/40 hover:bg-black/50"
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300 mb-2">Free Starter</p>
                    <p className="text-sm font-black text-white leading-tight mb-2">{lab.title}</p>
                    <p className="text-[10px] text-gray-500">{lab.difficulty} / {lab.duration}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>



          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-14">
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


          <div id="pricing" className="mb-16">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Pricing</h2>
                <p className="text-gray-500 text-sm">Start free. Upgrade when you're ready.</p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-gray-600">
                Free first. Upgrade for AI, chains and certificates.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="rounded-[28px] border border-emerald-500/15 bg-emerald-500/5 p-7 flex flex-col">
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300 mb-3">Early Access</p>
                <p className="text-4xl font-black text-white italic mb-1">EUR 5<span className="text-lg font-normal text-emerald-100/65"> forever</span></p>
                <p className="text-emerald-100/70 text-xs mb-2">Locked launch price for life.</p>
                <p className="text-[10px] uppercase tracking-[0.26em] text-emerald-200/80 mb-6">
                  {Number.isFinite(earlyAccessRemaining) ? `${earlyAccessRemaining} seats left` : 'limited founder seats'}
                </p>
                <ul className="space-y-2 mb-8 flex-grow">
                  {['All Starter labs','Save progress','Founder badge','Early supporter status','Price locked forever'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-emerald-50/80">
                      <span className="text-emerald-300 font-black">+</span> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => handleUpgrade('early')} className="w-full py-3 border border-emerald-400/20 text-white font-black uppercase tracking-widest italic rounded-2xl hover:bg-emerald-400/10 transition-all text-sm">
                  Get Early Access
                </button>
              </div>

              <div className="rounded-[28px] border border-red-500/25 bg-[linear-gradient(180deg,rgba(52,11,11,0.82),rgba(14,14,14,0.96))] p-7 flex flex-col shadow-[0_18px_60px_rgba(127,29,29,0.18)]">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-300 mb-3">Pro</p>
                <p className="text-4xl font-black text-white italic mb-1">EUR 19<span className="text-lg font-normal text-red-100/60">/mo</span></p>
                <p className="text-red-100/65 text-xs mb-6">Full platform access.</p>
                <ul className="space-y-2 mb-8 flex-grow">
                  {['All labs unlocked','Unlimited AI Mentor','Certificates','Advanced incident chains','Priority support'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-red-50/80">
                      <span className="text-red-400 font-black">+</span> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => handleUpgrade('pro')} className="w-full py-3 bg-red-600 text-white font-black uppercase tracking-widest italic rounded-2xl hover:bg-red-500 transition-all text-sm">
                  Go Pro
                </button>
              </div>

              <div className="bg-zinc-950 border border-white/10 rounded-[28px] p-7 flex flex-col hover:border-white/20 transition-colors">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-3">Lifetime</p>
                <p className="text-4xl font-black text-white italic mb-1">EUR 199<span className="text-lg font-normal text-gray-500"> once</span></p>
                <p className="text-gray-600 text-xs mb-6">Pay once, own forever.</p>
                <ul className="space-y-2 mb-8 flex-grow">
                  {['Everything in Pro','All future labs included','Lifetime updates','No recurring fees','Early access to new features'].map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="text-gray-300 font-black">+</span> {f}
                    </li>
                  ))}
                </ul>
                <button onClick={() => handleUpgrade('lifetime')} className="w-full py-3 border border-white/10 text-white font-black uppercase tracking-widest italic rounded-2xl hover:bg-white/5 transition-all text-sm">
                  Get Lifetime
                </button>
              </div>
            </div>
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
              <div className="mb-10 rounded-3xl border border-white/8 bg-white/[0.03] p-5 text-left">
                <div className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-gray-500">
                  Operator level
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {LEVEL_OPTIONS.map((levelId) => {
                    const level = getLevelConfig(levelId);
                    const active = selectedLevelId === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        onClick={() => setSelectedLevelId(level.id)}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                          active
                            ? 'border-red-500/40 bg-red-600/10 text-white shadow-lg shadow-red-600/10'
                            : 'border-white/8 bg-black/20 text-gray-400 hover:border-white/15 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-black uppercase tracking-widest">{level.label}</div>
                        <div className="mt-2 text-[11px] leading-relaxed text-gray-500">
                          {level.description}
                        </div>
                        <div className="mt-3 text-[10px] uppercase tracking-[0.24em] text-gray-600">
                          {level.hintsEnabled ? 'hint available' : 'hint disabled'}
                        </div>
                      </button>
                    );
                  })}
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
