import { Shield, Lock, Eye, AlertTriangle } from 'lucide-react';

function PageNav() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
      <a href="/" className="flex items-center gap-2">
        <div className="w-6 h-6 bg-red-600 flex items-center justify-center rounded">
          <Shield className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="font-black tracking-tighter text-white italic text-lg">WINLAB</span>
      </a>
      <a href="/" className="text-xs text-gray-500 hover:text-white transition-colors">← Back to Dashboard</a>
    </nav>
  );
}

const MEASURES = [
  { icon: Lock, title: 'Encryption', body: 'All traffic is encrypted via TLS 1.3. Passwords hashed with bcrypt (cost 12). Sensitive fields encrypted with AES-256-CTR.' },
  { icon: Eye, title: 'Access Control', body: 'JWT-based auth with httpOnly cookies. Session tokens expire after 24 hours. Admin access is IP-restricted and MFA-protected.' },
  { icon: Shield, title: 'Container Isolation', body: 'Each lab session runs in an isolated Docker container. Containers are destroyed after session end. No host filesystem access.' },
  { icon: AlertTriangle, title: 'Responsible Disclosure', body: 'Found a vulnerability? Email security@winlab.cloud with details. We respond within 48 hours and aim to patch critical issues within 7 days.' },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans">
      <PageNav />
      <div className="max-w-3xl mx-auto px-6 py-20">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Security</p>
        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">Security Overview</h1>
        <p className="text-gray-500 mb-16 max-w-xl leading-relaxed">
          WinLab is built with security-first principles. Below is a summary of our technical measures and how to report vulnerabilities.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
          {MEASURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-zinc-950 border border-white/5 rounded-2xl p-6">
              <div className="w-8 h-8 bg-red-600/10 border border-red-600/20 rounded-lg flex items-center justify-center mb-4">
                <Icon className="w-4 h-4 text-red-500" />
              </div>
              <h3 className="font-black text-white uppercase tracking-tight italic mb-2">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>

        <div className="border border-white/5 rounded-2xl p-8 bg-zinc-950">
          <h2 className="font-black text-white uppercase italic tracking-tight mb-2">Report a Vulnerability</h2>
          <p className="text-sm text-gray-500 mb-4">
            If you discover a security issue, please disclose it responsibly. Do not exploit it or share it publicly before we have had a chance to fix it.
          </p>
          <a href="mailto:security@winlab.cloud" className="inline-block text-xs font-black uppercase tracking-widest text-red-500 hover:text-red-400 transition-colors">
            security@winlab.cloud →
          </a>
        </div>
      </div>
    </div>
  );
}
