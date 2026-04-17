/**
 * CircuitBreakerBanner
 *
 * Ascolta due sorgenti di segnale:
 *   1. eventBus → evento "CIRCUIT_OPEN" emesso dall'app stessa
 *   2. Polling /health ogni RETRY_INTERVAL secondi
 *
 * Quando il circuit breaker è aperto mostra un banner giallo fisso in cima
 * alla pagina con un countdown per il prossimo tentativo.
 * Si chiude automaticamente quando il backend risponde ok.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { eventBus } from "../core/eventBus.js";

const HEALTH_URL      = "/health";          // endpoint backend
const RETRY_INTERVAL  = 15;                 // secondi tra un tentativo e l'altro
const MAX_RETRIES     = 10;                 // dopo i quali smette di fare polling

export default function CircuitBreakerBanner() {
  const [open, setOpen]           = useState(false);
  const [countdown, setCountdown] = useState(RETRY_INTERVAL);
  const [attempt, setAttempt]     = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const countdownRef  = useRef(null);
  const retryRef      = useRef(null);
  const attemptRef    = useRef(0);

  // ── Prova a riconnettersi ────────────────────────────────────────────────
  const tryReconnect = useCallback(async () => {
    if (attemptRef.current >= MAX_RETRIES) return;

    attemptRef.current += 1;
    setAttempt(attemptRef.current);

    try {
      const res = await fetch(HEALTH_URL, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));

      if (res.ok && body?.status !== "CIRCUIT_OPEN") {
        // Backend raggiungibile → chiudi banner
        clearInterval(countdownRef.current);
        clearTimeout(retryRef.current);
        setOpen(false);
        setCountdown(RETRY_INTERVAL);
        return;
      }

      // Backend risponde ma con circuit aperto
      scheduleNextRetry();
    } catch {
      // Rete irraggiungibile
      scheduleNextRetry();
    }
  }, []);

  // ── Pianifica il prossimo tentativo con countdown ────────────────────────
  const scheduleNextRetry = useCallback(() => {
    clearInterval(countdownRef.current);
    clearTimeout(retryRef.current);

    setCountdown(RETRY_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    retryRef.current = setTimeout(tryReconnect, RETRY_INTERVAL * 1000);
  }, [tryReconnect]);

  // ── Apre il banner e avvia il ciclo di retry ─────────────────────────────
  const openBanner = useCallback(() => {
    setDismissed(false);
    setOpen(true);
    attemptRef.current = 0;
    setAttempt(0);
    scheduleNextRetry();
  }, [scheduleNextRetry]);

  // ── Ascolta eventBus ─────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = eventBus.on("CIRCUIT_OPEN", openBanner);
    return unsub;
  }, [openBanner]);

  // ── Pulizia al unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(countdownRef.current);
      clearTimeout(retryRef.current);
    };
  }, []);

  // ── Non mostrare se chiuso o dismissato ─────────────────────────────────
  if (!open || dismissed) return null;

  const tooManyAttempts = attempt >= MAX_RETRIES;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-3
                 bg-yellow-400 text-yellow-900 px-4 py-2.5 text-sm font-medium shadow-lg
                 border-b-2 border-yellow-500"
    >
      {/* Icona + messaggio */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg select-none" aria-hidden="true">⚠️</span>
        <span className="truncate">
          {tooManyAttempts
            ? "Backend non raggiungibile. Aggiorna la pagina o contatta il supporto."
            : "Sistema in manutenzione automatica. Riconnessione in corso..."}
        </span>
      </div>

      {/* Countdown + tentativo */}
      {!tooManyAttempts && (
        <div className="flex items-center gap-3 shrink-0 text-yellow-800 text-xs">
          <span className="tabular-nums whitespace-nowrap">
            Prossimo tentativo in{" "}
            <strong className="text-yellow-900">{countdown}s</strong>
            {attempt > 0 && (
              <span className="ml-1 opacity-70">(tentativo {attempt}/{MAX_RETRIES})</span>
            )}
          </span>

          {/* Pulsante "Riprova ora" */}
          <button
            onClick={() => {
              clearInterval(countdownRef.current);
              clearTimeout(retryRef.current);
              setCountdown(0);
              tryReconnect();
            }}
            className="px-2 py-0.5 rounded bg-yellow-600 text-white text-xs
                       hover:bg-yellow-700 active:bg-yellow-800 transition-colors"
          >
            Riprova ora
          </button>

          {/* Chiudi banner */}
          <button
            onClick={() => setDismissed(true)}
            aria-label="Chiudi notifica"
            className="ml-1 text-yellow-700 hover:text-yellow-900 text-base leading-none transition-colors"
          >
            ✕
          </button>
        </div>
      )}

      {tooManyAttempts && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Chiudi notifica"
          className="shrink-0 text-yellow-700 hover:text-yellow-900 text-base transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
}
