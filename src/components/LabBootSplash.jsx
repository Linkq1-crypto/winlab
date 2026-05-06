import { useState, useEffect } from 'react';
import { trackEvent } from '../lib/track.js';

const TYPE_COLOR = {
  system: 'text-slate-200 font-semibold',
  warning: 'text-amber-300',
  info: 'text-sky-300',
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
    category === 'codex' ? 'loading application workspace and failure revision'
    : category === 'ops' ? 'loading service failure state and verification checks'
    : category === 'business' ? 'preparing isolated incident environment'
    : runtime === 'codex' ? 'loading code-path failure context'
    : 'loading incident state and verification hooks';

  return [
    { type: 'system', text: `Allocating terminal session for ${title}...`, synthetic: true },
    { type: 'info', text: `Mounting workspace (${String(levelId || 'JUNIOR').toUpperCase()} mode)...`, synthetic: true },
    { type: 'warning', text: `${categoryAction}...`, synthetic: true },
    hintEnabled
      ? { type: 'success', text: 'Guidance channel available for this run.', synthetic: true }
      : { type: 'warning', text: `Guidance channel disabled for ${String(levelId || 'JUNIOR').toUpperCase()} mode.`, synthetic: true },
  ];
}

function formatBootLine(line) {
  const prefix = TYPE_PREFIX[line?.type] ?? '[log]';
  const text = String(line?.text || '');
  return `${prefix.padEnd(8, ' ')} ${text}`;
}

export default function LabBootSplash({ bootSequence, onReady, lab = null, sessionId = null, levelId = 'JUNIOR', hintEnabled = true }) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [allVisible, setAllVisible] = useState(false);
  const fullSequence = [...buildWarmupSequence({ lab, levelId, hintEnabled }), ...(bootSequence || [])];

  useEffect(() => {
    setVisibleCount(0);
    setAllVisible(false);
  }, [bootSequence, hintEnabled, lab, levelId]);

  useEffect(() => {
    trackEvent('lab_boot_started', {
      labId: lab?.id,
      labTitle: lab?.title,
      levelId,
      source: 'LabBootSplash',
      sessionId,
    });
  }, [lab?.id, lab?.title, levelId, sessionId]);

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
    trackEvent('lab_boot_completed', {
      labId: lab?.id,
      labTitle: lab?.title,
      levelId,
      source: 'LabBootSplash',
      sessionId,
    });
    const onKey = () => onReady();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allVisible, lab?.id, lab?.title, levelId, onReady, sessionId]);

  return (
    <div
      className="fixed inset-0 z-50 cursor-pointer overflow-hidden bg-[linear-gradient(180deg,#06090f_0%,#0a1119_45%,#04070c_100%)] px-6 py-10 font-mono md:px-12 md:py-16"
      onClick={allVisible ? onReady : undefined}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:100%_4px] opacity-10" />
      <div className="relative mx-auto flex h-full w-full max-w-5xl items-center">
        <div className="w-full rounded-[28px] border border-white/8 bg-[#091018]/92 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-10">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-sky-300/70">
                WinLab Incident Session
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100 md:text-3xl">
                Environment initialization in progress
              </div>
            </div>
            <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-amber-200">
              preparing terminal
            </div>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-[#060c13] px-4 py-4 md:px-5">
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
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300 transition-all duration-300"
                  style={{ width: `${Math.max(8, (visibleCount / Math.max(fullSequence.length, 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {allVisible && (
            <div className="mt-10 flex items-center justify-between gap-4">
              <div className="text-sm text-zinc-400">
                Environment ready. Open the terminal to begin incident work.
              </div>
              <div className="rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-sky-100 animate-pulse">
                press any key to enter
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
