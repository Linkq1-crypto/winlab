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

const CONTACTS = [
  { label: 'General',   email: 'hello@winlab.cloud',    desc: 'General enquiries and partnerships.' },
  { label: 'Support',   email: 'support@winlab.cloud',  desc: 'Technical issues and account help. Response within 24 hours.' },
  { label: 'Billing',   email: 'billing@winlab.cloud',  desc: 'Subscription, invoices, and payment questions.' },
  { label: 'Security',  email: 'security@winlab.cloud', desc: 'Vulnerability reports and responsible disclosure.' },
  { label: 'Privacy',   email: 'privacy@winlab.cloud',  desc: 'GDPR requests, data deletion, privacy enquiries.' },
  { label: 'Sales',     email: 'sales@winlab.cloud',    desc: 'Team plans, corporate accounts, bulk licensing.' },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-sans">
      <PageNav />
      <div className="max-w-3xl mx-auto px-6 py-20">
        <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-4">Support</p>
        <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-4">Contact</h1>
        <p className="text-gray-500 mb-16 max-w-xl leading-relaxed">
          We're a small team — reach us at the right address and we'll get back to you fast.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CONTACTS.map(({ label, email, desc }) => (
            <div key={label} className="bg-zinc-950 border border-white/5 rounded-2xl p-6 hover:border-red-600/30 transition-colors group">
              <p className="text-[9px] font-black uppercase tracking-widest text-gray-600 mb-2">{label}</p>
              <a
                href={`mailto:${email}`}
                className="text-sm font-mono text-red-500 group-hover:text-red-400 transition-colors block mb-3"
              >
                {email}
              </a>
              <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
