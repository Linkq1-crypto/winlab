#!/usr/bin/env node
// Show queue status — pending, active, completed, failed jobs
import { publishQueue } from "./queue/queue.mjs";

const [waiting, active, completed, failed, delayed] = await Promise.all([
  publishQueue.getWaitingCount(),
  publishQueue.getActiveCount(),
  publishQueue.getCompletedCount(),
  publishQueue.getFailedCount(),
  publishQueue.getDelayedCount(),
]);

console.log("\n── WinLab Publisher Queue Status ─────────────────────\n");
console.log(`  Scheduled (delayed) : ${delayed}`);
console.log(`  Waiting             : ${waiting}`);
console.log(`  Active              : ${active}`);
console.log(`  Completed           : ${completed}`);
console.log(`  Failed              : ${failed}`);

if (failed > 0) {
  const failedJobs = await publishQueue.getFailed(0, 10);
  console.log("\n── Failed Jobs ───────────────────────────────────────\n");
  failedJobs.forEach(j => {
    console.log(`  [${j.id}] ${j.data.platform} | ${j.data.mediaPath ?? j.data.video}`);
    console.log(`         Error: ${j.failedReason}`);
    console.log(`         Attempts: ${j.attemptsMade}\n`);
  });
}

if (delayed > 0) {
  const delayedJobs = await publishQueue.getDelayed(0, 20);
  console.log("\n── Scheduled Posts ───────────────────────────────────\n");
  for (const j of delayedJobs) {
    const runsAt = new Date(Date.now() + (j.delay ?? 0)).toLocaleString("it-IT", { timeZone: "Europe/Rome" });
    console.log(`  [${j.id}] ${j.data.platform} | ${j.data.video ?? j.data.mediaPath} → ${runsAt}`);
  }
}

console.log("\n");
await publishQueue.close();
process.exit(0);
