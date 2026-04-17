import { Queue, QueueEvents } from "bullmq";
import { REDIS } from "../config.mjs";

export const publishQueue = new Queue("winlab-publish", {
  connection: REDIS,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },  // retry: 1min, 2min, 4min
    removeOnComplete: { count: 100 },
    removeOnFail:     { count: 200 },
  },
});

export const queueEvents = new QueueEvents("winlab-publish", { connection: REDIS });

// Schedule a post for a specific datetime
export async function schedulePost(post, scheduledAt) {
  const delay = new Date(scheduledAt).getTime() - Date.now();
  if (delay < 0) throw new Error(`scheduledAt is in the past: ${scheduledAt}`);

  const job = await publishQueue.add("publish-post", post, { delay });
  return job.id;
}

// Post immediately (for testing)
export async function postNow(post) {
  const job = await publishQueue.add("publish-post", post);
  return job.id;
}
