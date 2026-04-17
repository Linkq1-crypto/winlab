/**
 * Helpdesk Worker — Processes queued helpdesk jobs
 * Runs AI triage, categorization, and auto-responses
 * 
 * Usage: Import and start in your main server file
 * import { startHelpdeskWorker } from './src/services/helpdeskWorker.js';
 * startHelpdeskWorker();
 */

import { helpdeskQueue } from './helpdeskQueue.js';

// In-memory ticket store (same reference as service)
// In production, use Prisma DB

let workerRunning = false;
let workerInterval = null;
const PROCESS_INTERVAL = 5000; // Process every 5 seconds

/**
 * Process a single job from the queue
 * @param {object} job - The job to process
 */
async function processJob(job) {
  const { ticketId, from, subject, priority } = job.data;

  console.log(`🎫 Processing ticket: ${ticketId} | ${subject} | Priority: ${priority}`);

  try {
    // TODO: Integrate Qwen AI for:
    // 1. Analyze email content
    // 2. Categorize ticket (bug, question, feature request, billing, etc.)
    // 3. Determine urgency
    // 4. Suggest auto-response or escalation
    
    // Placeholder: Simulate AI processing
    const analysis = {
      category: 'general', // TODO: Use Qwen to classify
      urgency: priority > 5 ? 'high' : 'normal',
      sentiment: 'neutral', // TODO: Use Qwen for sentiment
      suggestedAction: 'manual_review', // TODO: Use Qwen to suggest action
    };

    console.log(`  ✅ Analyzed: ${analysis.category} | ${analysis.urgency}`);

    // Mark job as complete
    await helpdeskQueue.complete(job.id, { analysis });

    return { success: true, analysis };
  } catch (error) {
    console.error(`  ❌ Failed to process ticket ${ticketId}:`, error.message);
    await helpdeskQueue.fail(job.id, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Start the helpdesk worker
 * Processes jobs from the queue at regular intervals
 */
export function startHelpdeskWorker() {
  if (workerRunning) {
    console.log('⚠️  Helpdesk worker already running');
    return;
  }

  workerRunning = true;
  console.log('🚀 Helpdesk worker started');

  workerInterval = setInterval(async () => {
    const job = await helpdeskQueue.getNext();
    if (job) {
      await processJob(job);
    }
  }, PROCESS_INTERVAL);
}

/**
 * Stop the helpdesk worker
 */
export function stopHelpdeskWorker() {
  if (!workerRunning) return;
  
  workerRunning = false;
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  console.log('🛑 Helpdesk worker stopped');
}

/**
 * Process a single job immediately (for testing)
 * @param {object} jobData - Job payload
 */
export async function processJobImmediately(jobData) {
  const job = await helpdeskQueue.add('process-email', jobData);
  return processJob(job);
}

export default { startHelpdeskWorker, stopHelpdeskWorker, processJobImmediately };
