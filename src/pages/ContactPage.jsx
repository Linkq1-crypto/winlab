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

const CONTACTS = [
  { label: 'General', email: 'hello@winlab.cloud', desc: 'General enquiries and partnerships.' },
  { label: 'Support', email: 'support@winlab.cloud', desc: 'Technical issues and account help. Response within 24 hours.' },
  { label: 'Billing', email: 'billing@winlab.cloud', desc: 'Subscription, invoices, and payment questions.' },
  { label: 'Security', email: 'security@winlab.cloud', desc: 'Vulnerability reports and responsible disclosure.' },
  { label: 'Privacy', email: 'privacy@winlab.cloud', desc: 'GDPR requests, data deletion, privacy enquiries.' },
  { label: 'Sales', email: 'sales@winlab.cloud', desc: 'Team plans, corporate accounts, bulk licensing.' },
];

export default function ContactPage() {
  return (
    <div className="winlab-public-page font-sans">
      <PageNav />
      <div className="winlab-public-main max-w-3xl">
        <div className="winlab-public-hero">
          <p className="winlab-public-eyebrow">Support</p>
          <h1 className="winlab-public-title">Contact</h1>
          <p className="winlab-public-copy mb-8">
            Reach the right inbox fast and get a reply without digging through a crowded page.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CONTACTS.map(({ label, email, desc }) => (
            <div key={label} className="winlab-public-card transition-colors hover:border-red-600/30">
              <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-gray-600">{label}</p>
              <a href={`mailto:${email}`} className="mb-3 block text-sm font-mono text-red-500 transition-colors hover:text-red-400">
                {email}
              </a>
              <p className="text-xs leading-relaxed text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
