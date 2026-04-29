import { useState, useEffect } from 'react';

const TYPE_COLOR = {
  system: 'text-amber-300 font-semibold',
  warning: 'text-orange-300',
  info: 'text-cyan-300',
  success: 'text-emerald-300',
  error: 'text-rose-300 font-semibold',
  prompt: 'text-zinc-300',
};

const TYPE_PREFIX = {
  system: '[sys]',
  warning: '[warn]',
  info: '[info]',
  success: '[ok]',
  error: '[fail]',
  prompt: '[input]',
};

const DELAY_BY_TYPE = {
  system: 620,
  warning: 760,
  info: 420,
  success: 440,
  error: 860,
  prompt: 520,
};

function buildWarmupSequence({ lab, levelId, hintEnabled }) {
  const category = String(lab?.category || '').toLowerCase();
  const runtime = String(lab?.runtimeType || '').toLowerCase();
  const title = lab?.title || 'incident sandbox';

  const categoryAction =
    category === 'codex' ? 'mounting application fault graph'
    : category === 'ops' ? 'replaying production degradation'
    : category === 'business' ? 'calibrating network simulation'
    : runtime === 'codex' ? 'injecting code-path regression'
    : 'injecting scenario failure state';

  return [
    { type: 'system', text: `Attaching shell for ${title}...`, synthetic: true },
    { type: 'info', text: `Mounting scenario workspace (${String(levelId || 'JUNIOR').toUpperCase()} mode)...`, synthetic: true },
    { type: 'warning', text: `${categoryAction}...`, synthetic: true },
    hintEnabled
      ? { type: 'success', text: 'Hint channel online. Mentor guidance available.', synthetic: true }
      : { type: 'warning', text: `Hint channel locked for ${String(levelId || 'JUNIOR').toUpperCase()} mode.`, synthetic: true },
  ];
}

function formatBootLine(line) {
  const prefix = TYPE_PREFIX[line?.type] ?? '[log]';
  const text = String(line?.text || '');
  return `${prefix.padEnd(8, ' ')} ${text}`;
}

export default function LabBootSplash({ bootSequence, onReady, lab = null, levelId = 'JUNIOR', hintEnabled = true }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [allVisible, setAllVisible] = useState(false);
  const fullSequence = [...buildWarmupSequence({ lab, levelId, hintEnabled }), ...(bootSequence || [])];

  useEffect(() => {
    setVisibleCount(0);
    setAllVisible(false);
  }, [bootSequence, hintEnabled, lab, levelId]);

  useEffect(() => {
    if (visibleCount < fullSequence.length) {
      const current = fullSequence[visibleCount];
      const delay = visibleCount === 0
        ? 950
        : current?.synthetic
          ? 900
          : (DELAY_BY_TYPE[current?.type] ?? 420);
      const t = setTimeout(
        () => setVisibleCount((v) => v + 1),
        delay
      );
      return () => clearTimeout(t);
    }

    const finalPause = setTimeout(() => setAllVisible(true), 1400);
    return () => clearTimeout(finalPause);
  }, [fullSequence, visibleCount]);

  useEffect(() => {
    if (!allVisible) return;
    const onKey = () => onReady();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allVisible, onReady]);

  return (
    <div
      className="fixed inset-0 z-50 cursor-pointer overflow-hidden bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.10),transparent_22%),radial-gradient(circle_at_80%_20%,rgba(245,158,11,0.10),transparent_20%),linear-gradient(180deg,#050816_0%,#090909_45%,#020202_100%)] px-6 py-10 font-mono md:px-12 md:py-16"
      onClick={allVisible ? onReady : undefined}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] opacity-20" />
      <div className="relative mx-auto flex h-full w-full max-w-5xl items-center">
        <div className="w-full rounded-[28px] border border-emerald-500/15 bg-black/45 p-6 shadow-[0_0_80px_rgba(16,185,129,0.08)] backdrop-blur-sm md:p-10">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-emerald-400/80">
                WinLab Incident Router
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100 md:text-3xl">
                Environment handoff in progress
              </div>
            </div>
            <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-amber-200">
              live boot
            </div>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-[#050b11] px-4 py-4 md:px-5">
            <div className="max-h-[52vh] overflow-y-auto overflow-x-hidden font-mono text-sm leading-7 text-zinc-200">
              {fullSequence.slice(0, visibleCount).map((line, i) => (
                <div
                  key={i}
                  className={`whitespace-pre-wrap break-words ${TYPE_COLOR[line.type] ?? 'text-zinc-300'}`}
                >
                  {formatBootLine(line)}
                </div>
              ))}
            </div>
          </div>

          {!allVisible && (
            <div className="mt-8">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-amber-300 transition-all duration-300"
                  style={{ width: `${Math.max(8, (visibleCount / Math.max(fullSequence.length, 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {allVisible && (
            <div className="mt-10 flex items-center justify-between gap-4">
              <div className="text-sm text-zinc-400">
                Routing complete. Terminal context is now calibrated.
              </div>
              <div className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200 animate-pulse">
                press any key to enter
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
