// SocialSidebar.jsx — Floating social links bar (Lab-style)
import { X, Link2, Camera, Globe, Music2, MessageCircle } from 'lucide-react';

function YoutubeIcon({ size = 18, strokeWidth = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.54 6.42A2.78 2.78 0 0 0 20.6 4.46C18.88 4 12 4 12 4s-6.88 0-8.6.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.54C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
      <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
    </svg>
  );
}

const iconMap = {
  tiktok:   { icon: Music2,         label: 'TikTok',       color: 'hover:text-cyan-400'   },
  youtube:  { icon: YoutubeIcon,     label: 'YouTube',      color: 'hover:text-red-500'    },
  linkedin: { icon: Link2,          label: 'LinkedIn',     color: 'hover:text-blue-400'   },
  ig:       { icon: Camera,         label: 'Instagram',    color: 'hover:text-pink-400'   },
  fb:       { icon: Globe,          label: 'Facebook',     color: 'hover:text-blue-500'   },
  x:        { icon: X,              label: 'X (Twitter)',  color: 'hover:text-white'      },
  reddit:   { icon: MessageCircle,  label: 'Reddit',       color: 'hover:text-orange-400' },
};

export default function SocialSidebar({ links }) {
  const validLinks = Object.entries(links).filter(([_, url]) => url && url.trim() !== '');

  if (validLinks.length === 0) return null;

  return (
    <div
      className="fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1 p-2 rounded-full
                 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 shadow-2xl shadow-black/20"
      role="navigation"
      aria-label="Social media links"
    >
      {validLinks.map(([key, url]) => {
        const { icon: Icon, label, color } = iconMap[key] || {};
        if (!Icon) return null;

        return (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Follow us on ${label}`}
            className={`flex items-center justify-center w-10 h-10 rounded-full text-slate-500 ${color} transition-all duration-200 hover:scale-110`}
          >
            <Icon size={18} strokeWidth={1.5} />
          </a>
        );
      })}
    </div>
  );
}
