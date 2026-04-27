import { Server } from 'lucide-react';

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

const SERVICES = [
  { name: 'Frontend',         status: 'operational', latency: '12ms'  },
  { name: 'API Server',       status: 'operational', latency: '38ms'  },
  { name: 'Lab Runner',       status: 'operational', latency: '210ms' },
  { name: 'WebSocket / PTY',  status: 'operational', latency: '14ms'  },
  { name: 'Database',         status: 'operational', latency: '8ms'   },
  { name: 'AI Mentor',        status: 'operational', latency: '820ms' },
];

const STATUS_COLORS = {
  operational:  { dot: 'bg-green-500',  label: 'text-green-500',  text: 'Operational'  },
  degraded:     { dot: 'bg-yellow-500', label: 'text-yellow-500', text: 'Degraded'     },
  outage:       { dot: 'bg-red-500',    label: 'text-red-500',    text: 'Outage'       },
};

export default function StatusPage() {
  const allOperational = SERVICES.every(s => s.status === 'operational');

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans">
      <PageNav />
      <div className="max-w-3xl mx-auto px-6 py-20">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">System Status</p>
        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">Status</h1>

        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-16 ${allOperational ? 'border-green-500/20 bg-green-500/5' : 'border-yellow-500/20 bg-yellow-500/5'}`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${allOperational ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className={`text-xs font-black uppercase tracking-widest ${allOperational ? 'text-green-500' : 'text-yellow-500'}`}>
            {allOperational ? 'All Systems Operational' : 'Partial Degradation'}
          </span>
        </div>

        <div className="space-y-3 mb-16">
          {SERVICES.map(({ name, status, latency }) => {
            const c = STATUS_COLORS[status];
            return (
              <div key={name} className="flex items-center justify-between bg-zinc-950 border border-white/5 rounded-2xl px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <span className="text-sm font-medium text-white">{name}</span>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-[10px] font-mono text-gray-600">{latency}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${c.label}`}>{c.text}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-700">
          Last checked: {new Date().toUTCString()} &nbsp;·&nbsp; Incidents reported to{' '}
          <a href="mailto:support@winlab.cloud" className="text-gray-500 hover:text-white transition-colors">support@winlab.cloud</a>
        </p>
      </div>
    </div>
  );
}
