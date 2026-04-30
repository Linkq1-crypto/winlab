import { Server } from 'lucide-react';

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
        <a href="/" className="text-xs text-gray-500 transition-colors hover:text-white">Back</a>
      </div>
    </nav>
  );
}

const SERVICES = [
  { name: 'Frontend', status: 'operational', latency: '12ms' },
  { name: 'API Server', status: 'operational', latency: '38ms' },
  { name: 'Lab Runner', status: 'operational', latency: '210ms' },
  { name: 'WebSocket / PTY', status: 'operational', latency: '14ms' },
  { name: 'Database', status: 'operational', latency: '8ms' },
  { name: 'AI Mentor', status: 'operational', latency: '820ms' },
];

const STATUS_COLORS = {
  operational: { dot: 'bg-green-500', label: 'text-green-500', text: 'Operational' },
  degraded: { dot: 'bg-yellow-500', label: 'text-yellow-500', text: 'Degraded' },
  outage: { dot: 'bg-red-500', label: 'text-red-500', text: 'Outage' },
};

export default function StatusPage() {
  const allOperational = SERVICES.every((service) => service.status === 'operational');

  return (
    <div className="winlab-public-page font-sans">
      <PageNav />
      <div className="winlab-public-main max-w-3xl">
        <div className="winlab-public-hero">
          <p className="winlab-public-eyebrow">System Status</p>
          <h1 className="winlab-public-title">Status</h1>
          <p className="winlab-public-copy mb-6">
            Check core systems quickly without parsing a heavy dashboard layout on mobile.
          </p>
          <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 ${allOperational ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
            <div className={`h-2 w-2 rounded-full ${allOperational ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className={`text-xs font-black uppercase tracking-[0.16em] ${allOperational ? 'text-green-500' : 'text-yellow-500'}`}>
              {allOperational ? 'All systems operational' : 'Partial degradation'}
            </span>
          </div>
        </div>

        <div className="mb-8 space-y-3">
          {SERVICES.map(({ name, status, latency }) => {
            const color = STATUS_COLORS[status];
            return (
              <div key={name} className="winlab-public-card flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${color.dot}`} />
                  <span className="truncate text-sm text-white">{name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] font-mono text-gray-600">{latency}</div>
                  <div className={`text-[10px] font-black uppercase tracking-[0.14em] ${color.label}`}>{color.text}</div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-700">
          Last checked: {new Date().toUTCString()} · Incidents: <a href="mailto:support@winlab.cloud" className="text-gray-500 transition-colors hover:text-white">support@winlab.cloud</a>
        </p>
      </div>
    </div>
  );
}
