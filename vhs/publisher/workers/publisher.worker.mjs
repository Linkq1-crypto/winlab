// BullMQ Worker — picks jobs from the queue and publishes to the right platform
import { Worker } from "bullmq";
import { REDIS } from "../config.mjs";
import { publishInstagram } from "../bots/instagram.bot.mjs";
import { publishFacebook  } from "../bots/facebook.bot.mjs";
import { publishLinkedIn  } from "../bots/linkedin.bot.mjs";
import { publishTikTok    } from "../bots/tiktok.bot.mjs";
import { humanDelay } from "../utils/humanize.mjs";
import { log } from "../utils/logger.mjs";

const PUBLISHERS = {
  // "facebook" ora pubblica FB + IG insieme via Meta Business Suite Composer
  facebook:  publishFacebook,
  // "instagram" standalone (se vuoi solo IG senza FB)
  instagram: publishInstagram,
  linkedin:  publishLinkedIn,
  tiktok:    publishTikTok,
  // youtube: disabilitato — upload manuale (no Google API key richiesta)
};

const worker = new Worker(
  "winlab-publish",
  async (job) => {
    const { platform, ...payload } = job.data;

    log.info(`[WORKER] Job ${job.id} started`, { platform, attempt: job.attemptsMade + 1 });

    const publisher = PUBLISHERS[platform];
    if (!publisher) throw new Error(`Unknown platform: ${platform}`);

    // Random pre-publish delay (1-8s) — looks more human
    await humanDelay(1000, 8000);

    await publisher(payload);

    log.ok(`[WORKER] Job ${job.id} done`, { platform });
    return { platform, publishedAt: new Date().toISOString() };
  },
  {
    connection: REDIS,
    concurrency: 1,  // one platform at a time — safer for anti-ban
    limiter: {
      max: 5,         // max 5 jobs per
      duration: 3600_000,  // 1 hour window
    },
  }
);

worker.on("completed", (job, result) => {
  log.ok(`[WORKER] Completed job ${job.id}`, result);
});

worker.on("failed", (job, err) => {
  log.error(`[WORKER] Failed job ${job?.id}`, { error: err.message, attempt: job?.attemptsMade });
});

worker.on("error", err => {
  log.error("[WORKER] Worker error", { error: err.message });
});

log.info("[WORKER] Publisher worker running — waiting for jobs...");
log.info(`[WORKER] Redis: ${REDIS.host}:${REDIS.port}`);

// Graceful shutdown
process.on("SIGTERM", async () => {
  log.info("[WORKER] Shutting down...");
  await worker.close();
  process.exit(0);
});
