import { useState, useEffect, useRef, useCallback } from 'react';
import { useLab } from './LabContext';
import { getMentorResponse } from './mentor/mentorResponse.js';
import { buildMentorFeedbackPayload, createMentorMessage, submitMentorFeedback } from './services/mentorFeedback.js';
import { readStoredAiConsentPreference, saveAiConsentPreference } from './services/aiConsent.js';

const INACTIVITY_MS = 20_000;

export default function AIMentor({ labId, labState = {}, sessionId = null, userId = null }) {
  const { useHint, hintCount, maxHints, plan } = useLab();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [aiConsent, setAiConsent] = useState(null);
  const [showConsent, setShowConsent] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));
  const inactivityRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const cachedConsent = readStoredAiConsentPreference();
    if (typeof cachedConsent === 'boolean') {
      setAiConsent(cachedConsent);
    }

    fetch('/api/user/profile', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setAiConsent(data.aiMentorConsent === true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  async function saveAiConsent(consented) {
    setConsentSaving(true);
    try {
      await saveAiConsentPreference({
        consent: consented,
        timestamp: new Date().toISOString(),
      });
      setAiConsent(consented);
      setShowConsent(false);
      if (consented) setOpen(true);
    } finally {
      setConsentSaving(false);
    }
  }

  function openWithConsentCheck() {
    if (aiConsent === true) {
      setOpen(true);
    } else {
      setShowConsent(true);
    }
  }

  const resetTimer = useCallback(() => {
    window.clearTimeout(inactivityRef.current);
    inactivityRef.current = window.setTimeout(() => {
      if (!open) setNudge(true);
    }, INACTIVITY_MS);
  }, [open]);

  useEffect(() => {
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();
    return () => {
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.clearTimeout(inactivityRef.current);
    };
  }, [resetTimer]);

  async function ask(question) {
    if (!question.trim()) return;
    if (!useHint()) return;

    setMessages((current) => [...current, createMentorMessage({ role: 'user', text: question })]);
    setInput('');
    setLoading(true);

    try {
      const response = await getMentorResponse(
        {
          labId,
          commandHistory: labState?.commandHistory ?? [],
          terminalOutput: labState?.terminalOutput ?? '',
          verifyResult: labState?.verifyResult ?? null,
          elapsedMinutes: labState?.elapsedMinutes ?? 0,
          hints: labState?.mentorHints ?? [],
          shownHintIndices: labState?.shownHintIndices ?? [],
          userQuestion: question,
          forceAI: false,
        },
        async () => {
          const res = await fetch('/api/ai/help', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ cmd: question, context: { labId, sessionId, ...labState }, labId }),
          });
          const data = await res.json();
          return data.hint;
        }
      );

      setMessages((current) => [
        ...current,
        createMentorMessage({
          role: 'ai',
          text: response.content,
          cached: response.type === 'hint',
        }),
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        createMentorMessage({ role: 'ai', text: 'What is the first service you would check in this situation?' }),
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(messageId, feedback) {
    const targetMessage = messages.find((message) => message.messageId === messageId);
    if (!targetMessage || targetMessage.feedbackState === 'loading' || targetMessage.feedbackSavedValue) return;

    setMessages((current) =>
      current.map((message) =>
        message.messageId === messageId
          ? { ...message, feedbackState: 'loading', feedbackError: '' }
          : message
      )
    );

    try {
      const payload = buildMentorFeedbackPayload({
        labId,
        sessionId,
        userId,
        message: targetMessage,
        feedback,
      });

      await submitMentorFeedback(fetch, payload);

      setMessages((current) =>
        current.map((message) =>
          message.messageId === messageId
            ? {
                ...message,
                feedbackState: 'saved',
                feedbackSavedValue: feedback,
                feedbackError: '',
              }
            : message
        )
      );
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.messageId === messageId
            ? {
                ...message,
                feedbackState: 'error',
                feedbackError: error.message || 'Unable to save feedback.',
              }
            : message
        )
      );
    }
  }

  function handleKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ask(input);
    }
  }

  const hintsLeft = maxHints === Infinity ? 'inf' : Math.max(0, maxHints - hintCount);
  const floatingButtonClass = isMobile
    ? 'fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-xl text-white shadow-lg shadow-blue-600/40'
    : 'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl text-white shadow-lg shadow-blue-600/40 transition-transform hover:scale-105';

  if (!open && !showConsent && nudge) {
    return (
      <div className={`fixed z-40 flex ${isMobile ? 'left-4 right-4 bottom-20 flex-col gap-2' : 'bottom-6 right-6 flex-col items-end gap-2'}`}>
        <div className={`rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 shadow-xl ${isMobile ? 'w-full' : 'max-w-[220px] rounded-br-sm'}`}>
          <p className="text-sm font-medium text-white">Need a hint?</p>
          <p className="mt-0.5 text-xs text-slate-400">I can guide you without giving away the answer.</p>
        </div>
        <div className={`flex gap-2 ${isMobile ? 'w-full flex-col' : ''}`}>
          <button
            type="button"
            onClick={() => setNudge(false)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-400 hover:text-white"
          >
            No thanks
          </button>
          <button
            type="button"
            onClick={() => {
              setNudge(false);
              openWithConsentCheck();
            }}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500"
          >
            Ask mentor
          </button>
        </div>
      </div>
    );
  }

  if (!open && !showConsent) {
    return (
      <button type="button" onClick={openWithConsentCheck} className={floatingButtonClass} title="AI Mentor">
        AI
        {hintCount > 0 && plan === 'starter' && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-xs text-white">
            {hintsLeft}
          </span>
        )}
      </button>
    );
  }

  if (showConsent) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[90dvh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-2xl">AI</div>
          <h2 className="mb-2 text-lg font-bold text-gray-900">AI Mentor uses a third-party service</h2>
          <p className="mb-4 text-sm leading-relaxed text-gray-500">
            WinLab&apos;s AI Mentor is powered by Anthropic&apos;s Claude API. Your lab commands and questions are sent to Anthropic&apos;s servers for processing.
          </p>
          <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <div><strong>What is sent:</strong> your lab commands, questions, and error messages in the current session.</div>
            <div><strong>Not used for training:</strong> Anthropic does not use API data to train their models.</div>
            <div><strong>Where:</strong> Anthropic is based in the United States and transfer is covered by SCCs.</div>
          </div>
          <p className="mb-5 text-xs text-slate-500">
            You can use all labs without the AI Mentor. If you decline, every lab scenario remains fully accessible.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => saveAiConsent(false)}
              disabled={consentSaving}
              className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-50"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={() => saveAiConsent(true)}
              disabled={consentSaving}
              className="flex-1 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:opacity-50"
            >
              {consentSaving ? 'Saving...' : 'Enable AI Mentor'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0d0d0f] shadow-2xl ${
        isMobile
          ? 'bottom-0 left-0 right-0 max-h-[58dvh] rounded-b-none rounded-t-3xl border-x-0 border-b-0'
          : 'bottom-6 right-6 w-80'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-white">AI Mentor</p>
          <p className="text-xs text-slate-500">
            {hintsLeft === 'inf' ? 'Unlimited hints' : `${hintsLeft} hint${hintsLeft !== 1 ? 's' : ''} left`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-lg text-slate-500 hover:text-white"
          aria-label="Close AI Mentor"
          title="Close AI Mentor"
        >
          x
        </button>
      </div>

      <div className={`flex-1 overflow-y-auto px-4 py-3 ${isMobile ? 'max-h-[34dvh]' : 'max-h-80 min-h-[120px]'} space-y-3`}>
        {messages.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-600">
            Ask me anything about this lab.
          </p>
        )}
        {messages.map((message) => (
          <div key={message.messageId} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                message.role === 'user' ? 'rounded-br-sm bg-blue-600 text-white' : 'rounded-bl-sm bg-slate-800 text-slate-200'
              }`}
            >
              {message.text}
              {message.cached && <span className="mt-1 block text-xs text-slate-500">instant</span>}
              {message.role === 'ai' && (
                <div className="mt-2 space-y-2" data-testid={`mentor-feedback-${message.messageId}`}>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleFeedback(message.messageId, 'confirm')}
                      disabled={message.feedbackState === 'loading' || Boolean(message.feedbackSavedValue)}
                      className="rounded-md border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-300 transition-colors hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Confirm mentor suggestion"
                    >
                      {message.feedbackState === 'loading' ? 'Saving...' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFeedback(message.messageId, 'deny')}
                      disabled={message.feedbackState === 'loading' || Boolean(message.feedbackSavedValue)}
                      className="rounded-md border border-rose-500/30 px-2 py-1 text-[11px] text-rose-300 transition-colors hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Deny mentor suggestion"
                    >
                      {message.feedbackState === 'loading' ? 'Saving...' : 'Deny'}
                    </button>
                  </div>
                  {message.feedbackState === 'saved' && (
                    <p className="text-[11px] text-emerald-300">
                      Feedback saved: {message.feedbackSavedValue === 'confirm' ? 'confirmed' : 'denied'}.
                    </p>
                  )}
                  {message.feedbackState === 'error' && (
                    <p className="text-[11px] text-amber-300">{message.feedbackError || 'Unable to save feedback.'}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl rounded-bl-sm bg-slate-800 px-3 py-2 text-sm text-slate-400">...</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-800 px-3 py-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKey}
            disabled={loading}
            placeholder="Ask a question..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => ask(input)}
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
          >
            Send
          </button>
        </div>
        {plan === 'starter' && hintCount >= 2 && (
          <p className="mt-2 text-center text-xs text-orange-400">
            {hintsLeft === 0 ? 'Hints exhausted, upgrade for unlimited.' : `${hintsLeft} hint${hintsLeft !== 1 ? 's' : ''} remaining on free plan.`}
          </p>
        )}
      </div>
    </div>
  );
}
