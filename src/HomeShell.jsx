import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Clock,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Server,
  User,
  X,
} from 'lucide-react';
import SocialSidebar from './SocialSidebar';
import { LEVEL_OPTIONS, getLevelConfig } from './config/levels';
import { useSocialStorage } from './hooks/useSocialStorage';
import PWAInstallPrompt from './components/PWAInstallPrompt';

const LabTerminal = lazy(() => import('./components/LabTerminal'));
const LabBootSplash = lazy(() => import('./components/LabBootSplash'));
const RegisterModal = lazy(() => import('./components/RegisterModal'));
const CookieBanner = lazy(() => import('./CookieBanner'));
const AIMentor = lazy(() => import('./AIMentor'));

const CATEGORIES = ['All', 'Starter', 'Pro', 'Codex', 'Ops', 'Business'];

function buildInitialLogs() {
  return [
    { type: 'system', text: 'WINLAB INCIDENT ROUTER [v4.2.0]' },
    { type: 'info', text: 'Booting secure environment...' },
    { type: 'info', text: 'Initializing neural link to edge nodes...' },
    { type: 'success', text: 'Link established. Latency: 14ms' },
    { type: 'warning', text: 'SCAN COMPLETE: runnable incidents detected.' },
    { type: 'info', text: 'Waiting for Operator authorization...' },
    { type: 'prompt', text: 'Type "login" or "1" to continue:' },
  ];
}

const FOOTER_LINKS = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works', href: '/how-it-works' },
      { label: 'Labs', href: '/' },
      { label: 'Blog', href: '/blog' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Security', href: '/security' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Contact', href: '/contact' },
      { label: 'Feedback', href: '/feedback' },
      { label: 'Profile', href: '/profile' },
      { label: 'Status', href: '/status' },
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
      try {
        setAuth(JSON.parse(stored));
      } catch {}
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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEarlyAccessSeats() {
      try {
        const res = await fetch('/api/early-access/seats', { credentials: 'include' });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || cancelled) return;
        setEarlyAccessRemaining(Number.isFinite(data.remaining) ? data.remaining : null);
      } catch {}
    }

    loadEarlyAccessSeats();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleCommand(event) {
    event.preventDefault();
    if (!inputValue.trim()) return;
    const cmd = inputValue.toLowerCase().trim();
    setTerminalLogs((prev) => [...prev, { type: 'user', text: `> ${inputValue}` }]);
    setInputValue('');
    setTimeout(() => {
      if (cmd === 'login' || cmd === 'start' || cmd === '1') {
        setTerminalLogs((prev) => [...prev, { type: 'info', text: 'Access authorized. Redirecting...' }]);
        setTimeout(() => setView('dashboard'), 600);
      } else if (cmd === 'help') {
        setTerminalLogs((prev) => [...prev, { type: 'system', text: 'Commands: login, help, clear' }]);
      } else if (cmd === 'clear') {
        setTerminalLogs([{ type: 'prompt', text: 'Type "login" or "1" to continue:' }]);
      } else {
        setTerminalLogs((prev) => [...prev, { type: 'error', text: `Unrecognized command: ${cmd}` }]);
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
          sessionId: crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        }),
      });
      if (res.status === 401) {
        setShowRegister(true);
        return;
      }
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
        lab,
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
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
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

  const filteredLabs = labCatalog.filter((lab) => {
    const matchCat = selectedCategory === 'All' || lab.category === selectedCategory;
    const matchSearch =
      lab.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lab.tags?.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });
  const starterLabs = labCatalog.filter((lab) => starterIds.has(lab.id));
  const featuredStarterLabs = starterLabs.slice(0, 5);
  const hideInstallPrompt = view === 'lab' || showRegister || showPaywall || Boolean(selectedLab);

  if (view === 'terminal') {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-black px-4 py-4 font-mono sm:px-6 lg:px-8">
        <Suspense fallback={null}>
          <CookieBanner />
        </Suspense>
        <PWAInstallPrompt hidden={hideInstallPrompt} />
        <SocialSidebar links={socialLinks} />
        <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-5xl items-center justify-center">
          <div className="flex max-h-[min(92dvh,820px)] min-h-[560px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 bg-zinc-900 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full border border-red-500/50 bg-red-500/40" />
                <div className="h-2.5 w-2.5 rounded-full border border-yellow-500/50 bg-yellow-500/40" />
                <div className="h-2.5 w-2.5 rounded-full border border-green-500/50 bg-green-500/40" />
              </div>
              <span className="truncate text-center text-[10px] font-bold uppercase tracking-[0.28em] text-gray-500">
                WinLab Operational Terminal
              </span>
              <button
                type="button"
                onClick={() => setView('dashboard')}
                className="rounded-full border border-cyan-400/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-cyan-200 transition-colors hover:bg-cyan-400/10"
              >
                Open Hub
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-cyan-400/10 bg-cyan-400/5 p-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.24em] text-cyan-200/80">Terminal-first incident training</p>
                  <h1 className="max-w-2xl break-words text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">
                    Real labs. Small screen safe.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-400">
                    Move from onboarding into runnable incidents without clipping the terminal, burying the CTA, or forcing horizontal scroll.
                  </p>
                </div>
                <div className="grid w-full gap-3 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setView('dashboard')}
                    className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-red-500 sm:min-w-[220px]"
                  >
                    Launch Free Labs
                  </button>
                  <a
                    href="#pricing"
                    onClick={() => setView('dashboard')}
                    className="block w-full rounded-2xl border border-white/10 px-4 py-3 text-center text-sm font-black uppercase tracking-[0.2em] text-gray-300 transition-colors hover:bg-white/5 sm:min-w-[220px]"
                  >
                    View Pricing
                  </a>
                </div>
              </div>

              <div className="space-y-1 text-sm leading-relaxed">
                <div className="mb-4 flex items-center gap-3 rounded-xl border border-cyan-400/10 bg-cyan-400/5 px-3 py-2 text-[10px] uppercase tracking-[0.24em] text-cyan-200/80">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                  {catalogLoading ? 'syncing lab catalog' : `${starterLabs.length} starter labs primed`}
                </div>
                {terminalLogs.map((log, index) =>
                  log ? (
                    <div
                      key={index}
                      className={`break-words ${
                        log.type === 'system'
                          ? 'font-bold text-blue-400'
                          : log.type === 'error'
                            ? 'font-bold text-red-500'
                            : log.type === 'success'
                              ? 'text-green-500'
                              : log.type === 'warning'
                                ? 'text-yellow-500'
                                : log.type === 'user'
                                  ? 'text-white'
                                  : 'text-gray-500'
                      }`}
                    >
                      {log.text}
                    </div>
                  ) : null
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
            <form onSubmit={handleCommand} className="flex shrink-0 flex-col gap-3 border-t border-white/5 bg-zinc-900/50 p-4 sm:flex-row sm:items-center sm:p-6">
              <span className="text-sm font-bold text-red-500">OP@WINLAB:~$</span>
              <input
                autoFocus
                className="w-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="Run command..."
              />
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'lab' && showSplash && activeSession?.bootSequence?.length > 0) {
    return (
      <Suspense
        fallback={
          <div className="flex min-h-screen min-h-[100dvh] items-center justify-center bg-[#050505] px-4 text-center text-xs font-mono uppercase tracking-[0.28em] text-slate-500">
            <div className="animate-pulse">booting lab shell</div>
          </div>
        }
      >
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

  if (view === 'lab' && activeSession) {
    return (
      <div className="relative flex min-h-screen min-h-[100dvh] min-w-0 flex-col overflow-hidden bg-[#050505] text-gray-300">
        {showRegister && (
          <Suspense fallback={null}>
            <RegisterModal onSuccess={handleAuthSuccess} onClose={() => setShowRegister(false)} />
          </Suspense>
        )}
        {showPaywall && <PaywallModal onUpgrade={handleUpgrade} onClose={() => { setShowPaywall(false); stopLab(); }} />}
        <PWAInstallPrompt hidden={hideInstallPrompt} />
        <SocialSidebar links={socialLinks} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center px-4 text-center text-xs font-mono uppercase tracking-[0.28em] text-slate-500">
                <div className="animate-pulse">attaching live terminal</div>
              </div>
            }
          >
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
          <AIMentor
            labId={activeSession.labId}
            labState={{}}
            sessionId={activeSession.sessionId}
            userId={auth?.id ?? null}
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] min-w-0 overflow-hidden bg-[#050505] text-gray-300">
      <Suspense fallback={null}>
        <CookieBanner />
      </Suspense>
      <PWAInstallPrompt hidden={hideInstallPrompt} />
      <SocialSidebar links={socialLinks} />
      {showRegister && (
        <Suspense fallback={null}>
          <RegisterModal onSuccess={handleAuthSuccess} onClose={() => setShowRegister(false)} />
        </Suspense>
      )}
      {showPaywall && <PaywallModal onUpgrade={handleUpgrade} onClose={() => setShowPaywall(false)} />}

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[min(82vw,18rem)] flex-col border-r border-white/5 bg-black transition-transform duration-300 md:static md:w-64 md:translate-x-0 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/5 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-red-600">
              <Server className="h-5 w-5 text-white" />
            </div>
            <span className="truncate text-xl font-black italic tracking-tighter text-white">WINLAB</span>
          </div>
          <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-full border border-white/10 p-2 text-gray-400 md:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="mt-4 flex-1 space-y-2 overflow-y-auto p-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('dashboard');
              setIsMobileMenuOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
              activeTab === 'dashboard' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-500 hover:bg-white/5'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" /> Dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              auth ? setActiveTab('profile') : setShowRegister(true);
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 font-bold transition-all ${
              activeTab === 'profile' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-gray-500 hover:bg-white/5'
            }`}
          >
            <User className="h-5 w-5" />
            <span className="truncate">{auth ? auth.name || auth.email : 'Sign In'}</span>
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
        <div className="shrink-0 border-t border-white/5 p-4">
          {auth ? (
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-600 transition-colors hover:text-red-500"
            >
              <LogOut className="h-4 w-4" /> Terminate Session
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="w-full rounded-2xl border border-red-500/20 px-4 py-3 text-[11px] font-black uppercase tracking-[0.22em] text-white transition-colors hover:bg-red-500/10"
            >
              Sign Up / Sign In
            </button>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-6xl min-w-0">
          <header className="sticky top-0 z-30 mb-8 rounded-3xl border border-white/5 bg-[#050505]/95 px-4 py-4 backdrop-blur md:static md:border-none md:bg-transparent md:px-0 md:py-0">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-red-300/80">Operational command</p>
                  <h1 className="break-words text-3xl font-black uppercase italic tracking-tighter text-white sm:text-4xl">
                    Operational Hub
                  </h1>
                  <p className="mt-2 text-sm font-medium text-gray-500">
                    Operator: <span className="text-white">{auth ? auth.name || auth.email : 'Guest'}</span>{' '}
                    <span className="text-gray-600">/</span> Status:{' '}
                    <span className="font-bold text-red-500">ACTIVE</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="shrink-0 rounded-2xl border border-white/10 p-3 text-gray-300 md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </button>
              </div>
              <div className="w-full rounded-2xl border border-white/5 bg-zinc-900 px-5 py-4 md:w-auto">
                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-gray-600">Catalog Integrity</p>
                <p className="text-lg font-black text-white sm:text-xl">{filteredLabs.length} / {labCatalog.length} MODULES</p>
              </div>
            </div>
          </header>

          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-white/5 bg-zinc-900 p-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedCategory === cat ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="relative w-full max-w-full lg:w-72">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
              <input
                type="text"
                placeholder="Search labs..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-2xl border border-white/5 bg-zinc-900 py-3 pl-12 pr-4 text-xs text-white outline-none focus:border-red-500/30"
              />
            </div>
          </div>

          {labError && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-400">
              {labError}
            </div>
          )}

          <section className="mb-10 rounded-[32px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_42%),linear-gradient(180deg,rgba(10,18,16,0.96),rgba(5,5,5,0.98))] p-5 sm:p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.35em] text-emerald-300/80">Start In The Free Zone</p>
                <h2 className="break-words text-3xl font-black uppercase italic tracking-tighter leading-tight text-white sm:text-4xl">
                  Let The First 5 Free Labs Drive The Homepage
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">
                  Get people into real incidents immediately with the free starter labs, then introduce pricing as the next step. Keep the catalog at the center of the homepage, not the paywall.
                </p>
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-3">
                {featuredStarterLabs.map((lab) => (
                  <button
                    key={lab.id}
                    type="button"
                    onClick={() => !labLoading && setSelectedLab(lab)}
                    className="w-full min-w-0 rounded-2xl border border-emerald-400/15 bg-black/35 px-4 py-4 text-left transition-all hover:border-emerald-300/40 hover:bg-black/50"
                  >
                    <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-emerald-300">Free Starter</p>
                    <p className="mb-2 text-sm font-black leading-tight text-white">{lab.title}</p>
                    <p className="text-[10px] text-gray-500">{lab.difficulty} / {lab.duration}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mb-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredLabs.map((lab) => (
              <div
                key={lab.id}
                onClick={() => !labLoading && lab.status !== 'placeholder' && setSelectedLab(lab)}
                className={`group relative flex min-w-0 cursor-pointer flex-col rounded-[32px] border p-6 transition-all duration-300 ${
                  lab.status === 'placeholder'
                    ? 'cursor-not-allowed border-white/5 bg-zinc-950/30 opacity-40 grayscale'
                    : 'border-white/10 bg-zinc-950 hover:-translate-y-1 hover:border-red-600/40 hover:shadow-2xl hover:shadow-red-900/10'
                }`}
              >
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div
                    className={`rounded-lg px-2.5 py-1 text-[8px] font-black uppercase tracking-widest border ${
                      lab.difficulty === 'Easy'
                        ? 'border-green-500/10 bg-green-500/5 text-green-500'
                        : lab.difficulty === 'Medium'
                          ? 'border-blue-500/10 bg-blue-500/5 text-blue-500'
                          : 'border-red-500/10 bg-red-500/5 text-red-500'
                    }`}
                  >
                    {lab.difficulty}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-gray-700">
                    <Clock className="h-3 w-3" /> {lab.duration}
                  </div>
                </div>
                <h3 className="mb-3 min-h-[3rem] break-words text-lg font-black uppercase italic leading-tight tracking-tight text-white transition-colors group-hover:text-red-500">
                  {lab.title}
                </h3>
                <div className="mb-6 flex flex-wrap gap-1">
                  {lab.tags?.map((tag) => (
                    <span key={tag} className="rounded bg-white/5 px-2 py-0.5 text-[8px] font-mono text-gray-500">
                      #{tag}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/5 pt-5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">{lab.category}</span>
                  <span className="text-xs font-black italic text-red-500">+{lab.xp} XP</span>
                </div>
              </div>
            ))}
          </section>

          <section id="pricing" className="mb-16">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="mb-2 text-2xl font-black uppercase italic tracking-tighter text-white">Pricing</h2>
                <p className="text-sm text-gray-500">Start free. Upgrade when you're ready.</p>
              </div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-gray-600">Free first. Upgrade for AI, chains and certificates.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <div className="flex flex-col rounded-[28px] border border-emerald-500/15 bg-emerald-500/5 p-7">
                <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-emerald-300">Early Access</p>
                <p className="mb-1 text-4xl font-black italic text-white">EUR 5<span className="text-lg font-normal text-emerald-100/65"> forever</span></p>
                <p className="mb-2 text-xs text-emerald-100/70">Locked launch price for life.</p>
                <p className="mb-6 text-[10px] uppercase tracking-[0.26em] text-emerald-200/80">
                  {Number.isFinite(earlyAccessRemaining) ? `${earlyAccessRemaining} seats left` : 'limited founder seats'}
                </p>
                <ul className="mb-8 space-y-2">
                  {['All Starter labs', 'Save progress', 'Founder badge', 'Early supporter status', 'Price locked forever'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-emerald-50/80">
                      <span className="font-black text-emerald-300">+</span> {feature}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => handleUpgrade('early')} className="w-full rounded-2xl border border-emerald-400/20 py-3 text-sm font-black uppercase tracking-widest italic text-white transition-all hover:bg-emerald-400/10">
                  Get Early Access
                </button>
              </div>

              <div className="flex flex-col rounded-[28px] border border-red-500/25 bg-[linear-gradient(180deg,rgba(52,11,11,0.82),rgba(14,14,14,0.96))] p-7 shadow-[0_18px_60px_rgba(127,29,29,0.18)]">
                <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-red-300">Pro</p>
                <p className="mb-1 text-4xl font-black italic text-white">EUR 19<span className="text-lg font-normal text-red-100/60">/mo</span></p>
                <p className="mb-6 text-xs text-red-100/65">Full platform access.</p>
                <ul className="mb-8 space-y-2">
                  {['All labs unlocked', 'Unlimited AI Mentor', 'Certificates', 'Advanced incident chains', 'Priority support'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-red-50/80">
                      <span className="font-black text-red-400">+</span> {feature}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => handleUpgrade('pro')} className="w-full rounded-2xl bg-red-600 py-3 text-sm font-black uppercase tracking-widest italic text-white transition-all hover:bg-red-500">
                  Go Pro
                </button>
              </div>

              <div className="flex flex-col rounded-[28px] border border-white/10 bg-zinc-950 p-7 transition-colors hover:border-white/20 md:col-span-2 xl:col-span-1">
                <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-gray-600">Lifetime</p>
                <p className="mb-1 text-4xl font-black italic text-white">EUR 199<span className="text-lg font-normal text-gray-500"> once</span></p>
                <p className="mb-6 text-xs text-gray-600">Pay once, own forever.</p>
                <ul className="mb-8 space-y-2">
                  {['Everything in Pro', 'All future labs included', 'Lifetime updates', 'No recurring fees', 'Early access to new features'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="font-black text-gray-300">+</span> {feature}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => handleUpgrade('lifetime')} className="w-full rounded-2xl border border-white/10 py-3 text-sm font-black uppercase tracking-widest italic text-white transition-all hover:bg-white/5">
                  Get Lifetime
                </button>
              </div>
            </div>
          </section>

          <footer className="border-t border-white/5 pb-10 pt-12">
            <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
              <div className="shrink-0">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-red-600">
                    <Server className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="font-black italic tracking-tighter text-white">WINLAB</span>
                </div>
                <p className="max-w-xs text-[11px] leading-relaxed text-gray-600">
                  Real-world IT incident labs. Learn by breaking things.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
                {FOOTER_LINKS.map((column) => (
                  <div key={column.heading}>
                    <p className="mb-3 text-[9px] font-black uppercase tracking-widest text-gray-500">{column.heading}</p>
                    <ul className="space-y-2">
                      {column.links.map((link) => (
                        <li key={link.label}>
                          <a href={link.href} className="text-xs text-gray-600 transition-colors hover:text-white">
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-10 text-[10px] text-gray-700">© {new Date().getFullYear()} WinLab. All rights reserved.</p>
          </footer>
        </div>
      </main>

      {selectedLab && view !== 'lab' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" onClick={() => setSelectedLab(null)} />
          <div className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-white/10 bg-zinc-900 p-5 shadow-2xl sm:p-8 md:p-10">
            <div className="text-center">
              <div className="mb-6 inline-flex rounded-full border border-red-600/20 bg-red-600/10 p-4">
                <AlertCircle className="h-10 w-10 text-red-600 sm:h-12 sm:w-12" />
              </div>
              <h2 className="mb-4 break-words text-2xl font-black uppercase italic tracking-tighter text-white sm:text-3xl md:text-4xl">
                {selectedLab.title}
              </h2>
              <p className="mx-auto mb-8 max-w-md text-sm italic text-gray-500">
                Initializing isolated Docker environment. Confirm launch?
              </p>
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-center">
                  <p className="mb-1 text-[10px] font-black uppercase text-gray-600">XP Reward</p>
                  <p className="text-xl font-black italic text-red-500">+{selectedLab.xp} XP</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/5 p-4 text-center">
                  <p className="mb-1 text-[10px] font-black uppercase text-gray-600">Time Limit</p>
                  <p className="text-xl font-black italic text-white">{selectedLab.duration}</p>
                </div>
              </div>
              <div className="mb-8 rounded-3xl border border-white/8 bg-white/[0.03] p-5 text-left">
                <div className="mb-3 text-[10px] font-black uppercase tracking-[0.28em] text-gray-500">Operator level</div>
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
                        <div className="mt-2 text-[11px] leading-relaxed text-gray-500">{level.description}</div>
                        <div className="mt-3 text-[10px] uppercase tracking-[0.24em] text-gray-600">
                          {level.hintsEnabled ? 'hint available' : 'hint disabled'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {labError && <p className="mb-4 font-mono text-sm text-red-400">{labError}</p>}
              <div className="flex flex-col gap-4 sm:flex-row">
                <button
                  type="button"
                  onClick={() => startLab(selectedLab)}
                  disabled={labLoading}
                  className="flex-1 rounded-3xl bg-red-600 py-4 font-black uppercase tracking-widest italic text-white transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50"
                >
                  {labLoading ? 'LAUNCHING...' : 'LAUNCH SESSION'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLab(null);
                    setLabError('');
                  }}
                  className="flex-1 rounded-3xl border border-white/10 py-4 font-black uppercase tracking-widest text-gray-500 transition-all hover:bg-white/5"
                >
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
      <div className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[32px] border border-white/10 bg-zinc-900 p-6 text-center shadow-2xl sm:p-8">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-gray-600 transition-colors hover:text-white">
          <X className="h-5 w-5" />
        </button>
        <div className="mb-4 text-5xl">T</div>
        <h2 className="mb-2 text-2xl font-black uppercase italic text-white">Lab Complete!</h2>
        <p className="mb-8 text-sm text-gray-500">Unlock all 34 labs, unlimited AI Mentor, and certificates.</p>
        <div className="mb-8 rounded-2xl border border-white/5 bg-white/5 p-4">
          <p className="mb-1 text-[10px] font-black uppercase text-gray-600">Pro Plan</p>
          <p className="text-3xl font-black text-white">$19<span className="text-sm font-normal text-gray-500">/mo</span></p>
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          className="w-full rounded-2xl bg-red-600 py-4 font-black uppercase tracking-widest italic text-white transition-all hover:bg-red-700"
        >
          UNLOCK EVERYTHING
        </button>
        <button type="button" onClick={onClose} className="mt-3 w-full text-xs text-gray-600 transition-colors hover:text-gray-400">
          Continue for free
        </button>
      </div>
    </div>
  );
}
