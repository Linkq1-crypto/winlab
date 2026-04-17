/**
 * Structured logger — pino
 *
 * Unico punto di configurazione per il logging del backend.
 * Log emessi come JSON a stdout (leggibili da Loki, Datadog, CloudWatch, ecc.)
 *
 * Livelli usati nel progetto:
 *   info  → operazioni normali (sync ok, deploy registrato)
 *   warn  → retry / degraded (messaggio riprocessato)
 *   error → errore definitivo (DLQ, crash handler)
 */

import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: {
    service: "winlab-backend",
    env: process.env.NODE_ENV || "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // In development stampa "pretty"; in prod JSON puro
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino/file",        // stdout JSON anche in dev (no pino-pretty dep)
      options: { destination: 1 },
    },
  }),
});

/**
 * Logger dedicato al subsistema di sincronizzazione eventi
 */
export const syncLogger = logger.child({ module: "sync" });

/**
 * Logger dedicato alla Dead Letter Queue
 */
export const dlqLogger = logger.child({ module: "dlq" });

export default logger;
