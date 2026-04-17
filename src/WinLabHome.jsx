// WinLabHome.jsx – Geo-targeted landing page (India vs West)
import React, { useEffect, useMemo, useState } from 'react';

// ─── Geo-targeting ────────────────────────────────────────────────────────────
function detectCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.includes('Kolkata') || tz.includes('Calcutta') || tz.includes('Mumbai')) return 'IN';
  } catch {}
  try {
    const lang = (navigator.language || navigator.languages?.[0] || '').toLowerCase();
    if (lang.includes('in') || lang.includes('hi')) return 'IN';
  } catch {}
  return 'US';
}

const GEO_CONTENT = {
  WEST: {
    badgePrimary: 'REAL CLI SANDBOX',
    badges: ['UBUNTU 22.04', 'DOCKER', 'SRE-LEVEL'],
    headline: 'Master Production Incidents.',
    subHeadline: 'Escape tutorial hell. Fix real Linux, Cloud, and SRE failures in a live sandbox.',
    cta: 'Launch Free Lab →',
    socialProof: 'Trusted by 1000+ SREs',
    solvedText: 'Incident Resolved. Time: 1m 20s. You are faster than 85% of DevOps.',
    pathTitle: 'The Elite SRE Path',
    path: [
      { level: 'Level 1', title: 'Core Linux', status: 'Free' },
      { level: 'Level 2', title: 'Cloud Infrastructure', status: 'Pro' },
      { level: 'Level 3', title: 'Chaos Engineering', status: 'Enterprise' },
    ],
    pricingCallout: '$19/mo • Unlimited labs',
  },
  INDIA: {
    badgePrimary: '₹20 PER LAB',
    badges: ['PRACTICE-BASED', 'INTERVIEW PREP', '₹20 PER LAB'],
    headline: 'Real-World Skills, Real Jobs.',
    subHeadline: 'Stop watching videos. Practice fixing real server problems for the price of a Chai.',
    cta: 'Start Solving (₹20) →',
    socialProof: 'Job-ready training for ₹199/mo',
    solvedText: 'Success! +15 XP. You are one step closer to your Junior Admin Level! 🔥',
    pathTitle: 'The Job-Ready Path',
    path: [
      { level: 'Level 1', title: 'System Admin Basics', status: 'Free' },
      { level: 'Level 2', title: 'Data Center Ops', status: '₹20/lab' },
      { level: 'Level 3', title: 'IT Support Expert', status: 'Job-Ready' },
    ],
    pricingCallout: '₹20 per incident • ₹199/mo unlimited',
  },
};

const AUTOTYPE_COMMAND = '$ systemctl status nginx... [FAILED]';

export default function WinLabHome({ country, onCTA }) {
  const detectedCountry = country || detectCountry();
  const isIndia = detectedCountry === 'IN';
  const content = isIndia ? GEO_CONTENT.INDIA : GEO_CONTENT.WEST;

  const [typedPreview, setTypedPreview] = useState('');
  const [liveEngineers, setLiveEngineers] = useState(isIndia ? 12 : 27);

  const [scenarioStarted, setScenarioStarted] = useState(false);
  const [scenarioLog, setScenarioLog] = useState([]);
  const [commandInput, setCommandInput] = useState('');
  const [scenarioSolved, setScenarioSolved] = useState(false);

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setTypedPreview(AUTOTYPE_COMMAND.slice(0, index));
      if (index >= AUTOTYPE_COMMAND.length) {
        clearInterval(timer);
      }
    }, 42);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveEngineers((n) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.min(40, Math.max(8, n + delta));
      });
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  const startScenario = () => {
    setScenarioStarted(true);
    setScenarioSolved(false);
    setScenarioLog([
      '[nginx] systemctl start nginx',
      'Error: Port 80 already in use.',
      "Hint: inspect listening processes with 'netstat -tulpn'",
    ]);
  };

  const submitCommand = () => {
    const cmd = commandInput.trim();
    if (!cmd) return;

    setScenarioLog((prev) => [...prev, `$ ${cmd}`]);

    if (cmd === 'netstat -tulpn') {
      setScenarioLog((prev) => [...prev, 'tcp 0 0 0.0.0.0:80 0.0.0.0:* LISTEN 1402/apache2']);
    } else if (cmd === 'sudo systemctl stop apache2') {
      setScenarioLog((prev) => [...prev, 'apache2 stopped']);
    } else if (cmd === 'sudo systemctl start nginx') {
      const apacheStopped = scenarioLog.some((line) => line.includes('apache2 stopped'));
      if (apacheStopped) {
        setScenarioLog((prev) => [...prev, 'nginx started successfully ✅']);
        setScenarioSolved(true);
      } else {
        setScenarioLog((prev) => [...prev, 'nginx failed: Port 80 already in use']);
      }
    } else {
      setScenarioLog((prev) => [...prev, `command not recognized in this lab: ${cmd}`]);
    }

    setCommandInput('');
  };

  const progressWidth = useMemo(() => (scenarioSolved ? 'w-full' : scenarioStarted ? 'w-1/2' : 'w-1/4'), [scenarioSolved, scenarioStarted]);

  const handleCTA = () => {
    if (onCTA) onCTA();
  };

  return (
    <main className="min-h-screen bg-[#0b0f1a] text-white">
      {/* NAV */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="text-lg font-bold tracking-tighter">WINLAB <span className="text-emerald-500 text-xs font-mono">PROD_SPEC</span></div>
        <button onClick={handleCTA} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-[#0b0f1a] hover:bg-emerald-400 transition">
          {content.cta}
        </button>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-14 md:grid-cols-[1.3fr_0.7fr]">
        <div>
          <span className="inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
            {content.badgePrimary}
          </span>

          <div className="mt-4 flex flex-wrap gap-2">
            {content.badges.map((badge) => (
              <span key={badge} className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[10px] font-bold tracking-wide text-slate-300">
                {badge}
              </span>
            ))}
          </div>

          <h1 className="mt-6 text-4xl font-extrabold leading-tight md:text-6xl">{content.headline}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">{content.subHeadline}</p>

          <div className="mt-8 flex flex-col items-start gap-3">
            <button onClick={handleCTA} className="rounded-xl bg-emerald-500 px-7 py-3 font-bold text-[#0b0f1a] transition hover:bg-emerald-400">
              {content.cta}
            </button>
            <p className="text-sm text-slate-400">{liveEngineers} engineers are fixing this incident right now</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Live preview</p>
          <div className="rounded-lg border border-slate-700 bg-black/70 p-3 font-mono text-sm text-emerald-400">
            <p>{typedPreview}<span className="animate-pulse">▌</span></p>
            <p className="mt-2 text-red-400">Error: Port 80 already in use.</p>
          </div>
          <p className="mt-3 text-xs text-slate-400">{content.socialProof}</p>
        </div>
      </section>

      {/* SCENARIO */}
      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="rounded-2xl border border-slate-800 bg-[#0d1117]">
          <div className="border-b border-slate-800 px-4 py-3 text-xs font-mono text-slate-400">Scenario 1 · The Port Conflict</div>
          <div className="p-4 font-mono text-sm">
            {!scenarioStarted && <p className="text-slate-500">Press CTA to start the nginx failure scenario.</p>}
            {scenarioStarted && (
              <>
                <div className="mb-3 h-48 overflow-auto rounded border border-slate-800 bg-black/60 p-3 text-slate-200">
                  {scenarioLog.map((line, idx) => (
                    <p key={`${line}-${idx}`} className={line.includes('Error') || line.includes('failed') ? 'text-red-400' : line.includes('LISTEN') ? 'text-amber-300' : 'text-slate-200'}>
                      {line}
                    </p>
                  ))}
                </div>
                <div className="flex gap-2">
                  <span className="text-emerald-400">$</span>
                  <input
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitCommand()}
                    placeholder="Try: netstat -tulpn"
                    className="w-full rounded bg-slate-900 px-2 py-1 text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-emerald-500"
                  />
                </div>
                {scenarioSolved && <p className="mt-3 text-emerald-400">{content.solvedText}</p>}
              </>
            )}
          </div>
        </div>
      </section>

      {/* PATH */}
      <section className="border-y border-slate-800 bg-slate-900/30 py-14">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-3xl font-bold">Your Path</h2>
          <p className="mt-1 text-slate-400">{content.pathTitle}</p>
          <div className="mt-4 h-2 w-full rounded-full bg-slate-800">
            <div className={`h-full rounded-full bg-emerald-500 transition-all ${progressWidth}`} />
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {content.path.map((item) => (
              <article key={item.level} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-widest text-slate-500">{item.level}</p>
                <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 inline-block rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-400">{item.status}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="mx-auto max-w-6xl px-6 py-14 text-center">
        <h2 className="text-3xl font-bold">Pricing built for action</h2>
        <p className="mt-2 text-slate-400">{content.pricingCallout}</p>
        <button onClick={handleCTA} className="mt-6 rounded-xl bg-white px-8 py-3 font-bold text-[#0b0f1a] hover:bg-slate-200 transition">
          Get Started
        </button>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/60 py-8">
        <div className="mx-auto max-w-6xl px-6 flex justify-between items-center text-xs text-slate-600">
          <span>© 2026 WINLAB</span>
          <div className="flex gap-4">
            <span className="hover:text-slate-400 cursor-pointer">Privacy</span>
            <span className="hover:text-slate-400 cursor-pointer">Terms</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
