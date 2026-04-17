// SocialConfig.jsx — Admin panel for social links management
import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useSocialStorage } from './hooks/useSocialStorage';

const PLATFORM_META = {
  tiktok:   { label: 'TikTok',      placeholder: 'https://tiktok.com/@yourhandle',           icon: '♪'  },
  youtube:  { label: 'YouTube',     placeholder: 'https://youtube.com/@yourchannel',          icon: '▶'  },
  linkedin: { label: 'LinkedIn',    placeholder: 'https://linkedin.com/company/yourcompany',  icon: 'in' },
  ig:       { label: 'Instagram',   placeholder: 'https://instagram.com/yourhandle',          icon: '📷' },
  fb:       { label: 'Facebook',    placeholder: 'https://facebook.com/yourpage',             icon: 'f'  },
  x:        { label: 'X (Twitter)', placeholder: 'https://x.com/yourhandle',                 icon: '𝕏'  },
  reddit:   { label: 'Reddit',      placeholder: 'https://reddit.com/r/yoursubreddit',        icon: '⚡' },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!text}
      className={`p-2 rounded transition-all shrink-0
        ${copied ? 'text-green-400' : 'text-slate-500 hover:text-cyan-400'}
        disabled:opacity-30 disabled:cursor-not-allowed`}
      aria-label={copied ? 'Copied!' : 'Copy link'}
      title={copied ? 'Copiato!' : 'Copia link'}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

export default function SocialConfig() {
  const [links, setLinks, updateLink] = useSocialStorage();
  const activeCount = Object.values(links).filter(v => v && v.trim() !== '').length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            🔗 Social Links
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure social icons — they appear as a floating bar on the right side
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          {activeCount}/6 active
        </span>
      </div>

      <div className="space-y-4">
        {Object.keys(links).map((key) => {
          const meta = PLATFORM_META[key];
          const hasValue = links[key] && links[key].trim() !== '';

          return (
            <div key={key} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-wider text-slate-500 font-mono">
                  {meta.icon} {key}_url
                </label>
                {hasValue && (
                  <a
                    href={links[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-slate-600 hover:text-blue-400 transition-colors flex items-center gap-1"
                  >
                    <ExternalLink size={10} /> Preview
                  </a>
                )}
              </div>

              <div className={`flex items-center gap-2 bg-slate-800/50 border rounded-lg p-1.5 transition-colors
                ${hasValue ? 'border-slate-700' : 'border-slate-800'}`}
              >
                <input
                  type="url"
                  value={links[key]}
                  onChange={(e) => updateLink(key, e.target.value)}
                  placeholder={meta.placeholder}
                  className="bg-transparent text-sm text-white placeholder-slate-600 outline-none flex-1 min-w-0"
                />
                <CopyButton text={links[key]} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview */}
      <div className="mt-6 pt-4 border-t border-slate-800">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-3">Live Preview</p>
        <div className="flex items-center gap-2 p-3 rounded-full bg-slate-800/30 border border-slate-800 w-fit">
          {Object.entries(links)
            .filter(([_, url]) => url && url.trim() !== '')
            .map(([key]) => (
              <span key={key} className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 text-xs border border-slate-700">
                {PLATFORM_META[key].icon}
              </span>
            ))}
          {activeCount === 0 && (
            <span className="text-xs text-slate-700">No social links configured</span>
          )}
        </div>
      </div>
    </div>
  );
}
