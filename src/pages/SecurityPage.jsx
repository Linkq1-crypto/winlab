import { AlertTriangle, Eye, Lock, Shield } from 'lucide-react';

function PageNav() {
  return (
    <nav className="winlab-public-nav">
      <a href="/" className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded bg-red-600">
          <Shield className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-lg font-black italic tracking-tighter text-white">WINLAB</span>
      </a>
      <div className="winlab-public-nav-links">
        <a href="/" className="text-xs text-gray-500 transition-colors hover:text-white">Back</a>
      </div>
    </nav>
  );
}

const MEASURES = [
  { icon: Lock, title: 'Encryption', body: 'Traffic uses TLS 1.3 and passwords are hashed with bcrypt.' },
  { icon: Eye, title: 'Access control', body: 'JWT auth uses httpOnly cookies and expiring sessions.' },
  { icon: Shield, title: 'Container isolation', body: 'Every lab session runs in its own isolated container.' },
  { icon: AlertTriangle, title: 'Disclosure', body: 'Report vulnerabilities to security@winlab.cloud and we respond within 48 hours.' },
];

export default function SecurityPage() {
  return (
    <div className="winlab-public-page font-sans">
      <PageNav />
      <div className="winlab-public-main max-w-3xl">
        <div className="winlab-public-hero">
          <p className="winlab-public-eyebrow">Security</p>
          <h1 className="winlab-public-title">Security Overview</h1>
          <p className="winlab-public-copy mb-8">
            A concise view of the controls behind WinLab, formatted to stay readable and calm on phones.
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {MEASURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="winlab-public-card">
              <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-xl bg-red-600/10 text-red-500">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="mb-2 text-base font-black text-white">{title}</h2>
              <p className="text-sm leading-relaxed text-gray-500">{body}</p>
            </div>
          ))}
        </div>

        <div className="winlab-public-card">
          <h2 className="mb-2 text-lg font-black text-white">Report a vulnerability</h2>
          <p className="mb-4 text-sm leading-relaxed text-gray-500">
            If you discover a security issue, disclose it responsibly and give us time to patch before sharing it publicly.
          </p>
          <a href="mailto:security@winlab.cloud" className="text-sm font-black text-red-500 transition-colors hover:text-red-400">
            security@winlab.cloud
          </a>
        </div>
      </div>
    </div>
  );
}
