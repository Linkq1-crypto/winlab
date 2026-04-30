import { Brain, CheckCircle, Server, Shield, Terminal, Zap } from 'lucide-react';

function PageNav() {
  return (
    <nav className="winlab-public-nav">
      <a href="/" className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-red-600">
          <Server className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-lg font-black italic tracking-tighter text-white">WINLAB</span>
      </a>
      <div className="winlab-public-nav-links">
        <a href="#start" className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white">Start</a>
        <a href="/" className="text-xs text-gray-500 transition-colors hover:text-white">Back</a>
      </div>
    </nav>
  );
}

const STEPS = [
  { number: '01', title: 'Pick a lab', body: 'Choose a real incident. Starter labs open immediately.' },
  { number: '02', title: 'Launch a session', body: 'WinLab starts an isolated environment with the failure already live.' },
  { number: '03', title: 'Fix it for real', body: 'Use the terminal, verify the system state, and move to the next incident.' },
];

const FEATURES = [
  { icon: Terminal, title: 'Real terminal', body: 'Actual shell access, not fake output.' },
  { icon: Shield, title: 'Isolated by default', body: 'Each session stays contained.' },
  { icon: Zap, title: 'Fast start', body: 'Get from click to prompt in seconds.' },
  { icon: Brain, title: 'AI Mentor', body: 'Hints stay contextual instead of generic.' },
  { icon: CheckCircle, title: 'Auto verification', body: 'The platform checks the real fix state.' },
  { icon: Server, title: 'Realistic stack', body: 'Labs use real services and configs.' },
];

export default function HowItWorksPage() {
  return (
    <div className="winlab-public-page font-sans">
      <PageNav />
      <div className="winlab-public-main max-w-4xl">
        <div className="winlab-public-hero">
          <p className="winlab-public-eyebrow">Platform</p>
          <h1 className="winlab-public-title">How WinLab Works</h1>
          <p className="winlab-public-copy mb-8">
            No videos, no multiple choice, no toy shell. Just a broken system, a terminal, and a fix that must actually work.
          </p>
          <a id="start" href="/" className="inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white">
            Start a free lab
          </a>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map(({ number, title, body }) => (
            <div key={number} className="winlab-public-card">
              <p className="mb-3 text-3xl font-black text-white/10">{number}</p>
              <h2 className="mb-2 text-lg font-black text-white">{title}</h2>
              <p className="text-sm leading-relaxed text-gray-500">{body}</p>
            </div>
          ))}
        </div>

        <h2 className="mb-4 text-xl font-black text-white">Under the hood</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="winlab-public-card">
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-xl bg-red-600/10 text-red-500">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="mb-2 text-sm font-black text-white">{title}</h3>
              <p className="text-xs leading-relaxed text-gray-500">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
