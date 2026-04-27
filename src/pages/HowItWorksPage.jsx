import { Server, Terminal, CheckCircle, Zap, Shield, Brain } from 'lucide-react';

function PageNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
      <a href="/" className="flex items-center gap-2">
        <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded">
          <Server className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-black tracking-tighter text-white italic text-lg">WINLAB</span>
      </a>
      <a href="/" className="text-xs text-gray-500 hover:text-white transition-colors">← Back to Dashboard</a>
    </nav>
  );
}

const STEPS = [
  {
    number: '01',
    title: 'Pick a Lab',
    body: 'Browse 34+ real-world incident scenarios across Linux, Kubernetes, databases, and application code. Starter labs are free — no account required.',
  },
  {
    number: '02',
    title: 'Launch a Container',
    body: 'Click Launch Session. We spin up an isolated Docker container pre-configured with the broken environment. Ready in seconds, no setup on your end.',
  },
  {
    number: '03',
    title: 'Fix the Incident',
    body: 'You get a live terminal inside the container. Diagnose and fix the issue exactly as you would on a real server. The AI Mentor can give hints without spoiling the solution.',
  },
];

const FEATURES = [
  { icon: Terminal,     title: 'Real Terminal',    body: 'xterm.js connected directly to Docker via WebSocket. No simulated output — actual bash, actual commands.' },
  { icon: Shield,       title: 'Fully Isolated',   body: 'Each session runs in its own container. Nothing you do can affect other users or the host system.' },
  { icon: Zap,          title: 'Instant Start',    body: 'Containers are pre-built. Session ready in under 5 seconds from click to shell prompt.' },
  { icon: Brain,        title: 'AI Mentor',        body: 'Stuck? The AI Mentor reads your session context and gives calibrated hints — not just the answer.' },
  { icon: CheckCircle,  title: 'Auto-Verified',    body: 'When you think you\'ve fixed it, run the verify command. The scorer checks the actual system state.' },
  { icon: Server,       title: 'Realistic Stack',  body: 'Labs run real services — nginx, PostgreSQL, Redis, Node.js, Python — not toy mocks.' },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans">
      <PageNav />
      <div className="max-w-4xl mx-auto px-6 py-20">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Platform</p>
        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">How It Works</h1>
        <p className="text-gray-500 mb-20 max-w-xl leading-relaxed">
          WinLab puts you inside real broken systems. No multiple choice, no videos — just you, a terminal, and a production incident to solve.
        </p>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {STEPS.map(({ number, title, body }) => (
            <div key={number} className="bg-zinc-950 border border-white/5 rounded-[28px] p-8">
              <p className="text-5xl font-black text-white/5 italic mb-4">{number}</p>
              <h3 className="font-black text-white uppercase italic tracking-tight text-xl mb-3">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        {/* Features */}
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-8">Under the Hood</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-zinc-950 border border-white/5 rounded-2xl p-6">
              <div className="w-8 h-8 bg-red-600/10 border border-red-600/20 rounded-lg flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-red-500" />
              </div>
              <h3 className="font-black text-white uppercase italic tracking-tight mb-2 text-sm">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="text-center">
          <a
            href="/"
            className="inline-block px-10 py-4 bg-red-600 text-white font-black uppercase tracking-widest italic rounded-3xl hover:bg-red-700 transition-all shadow-xl shadow-red-600/20"
          >
            START A FREE LAB →
          </a>
        </div>
      </div>
    </div>
  );
}
