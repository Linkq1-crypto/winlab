/**
 * Helpdesk Queue — Lightweight in-memory queue system
 * Can be upgraded to BullMQ/Redis later for production scale
 */

class HelpdeskQueue {
  constructor() {
    this._waiting = [];
    this._active = [];
    this._completed = [];
    this._failed = [];
    this._jobCounter = 0;
  }

  /**
   * Add a job to the queue
   * @param {string} name - Job type (e.g., 'process-email')
   * @param {object} data - Job payload
   * @param {object} [opts] - Options (priority, delay, etc.)
   * @returns {object} The created job
   */
  async add(name, data, opts = {}) {
    const job = {
      id: `job_${++this._jobCounter}_${Date.now()}`,
      name,
      data,
      priority: opts.priority || 0,
      attempts: 0,
      maxAttempts: opts.maxAttempts || 3,
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      status: 'waiting',
    };

    this._waiting.push(job);
    // Sort by priority (higher first)
    this._waiting.sort((a, b) => b.priority - a.priority);

    return job;
  }

  /**
   * Get next waiting job
   * @returns {object|null} Job or null if queue empty
   */
  async getNext() {
    if (this._waiting.length === 0) return null;

    const job = this._waiting.shift();
    job.status = 'active';
    job.startedAt = Date.now();
    job.attempts++;
    this._active.push(job);
    return job;
  }

  /**
   * Mark job as completed
   * @param {string} jobId
   * @param {object} [result] - Optional result data
   */
  async complete(jobId, result = {}) {
    const idx = this._active.findIndex(j => j.id === jobId);
    if (idx === -1) return;

    const job = this._active.splice(idx, 1)[0];
    job.status = 'completed';
    job.finishedAt = Date.now();
    job.result = result;
    this._completed.push(job);

    // Keep completed list bounded
    if (this._completed.length > 1000) {
      this._completed = this._completed.slice(-500);
    }
  }

  /**
   * Mark job as failed
   * @param {string} jobId
   * @param {string} [error] - Error message
   */
  async fail(jobId, error = 'Unknown error') {
    const idx = this._active.findIndex(j => j.id === jobId);
    if (idx === -1) return;

    const job = this._active.splice(idx, 1)[0];

    if (job.attempts < job.maxAttempts) {
      // Retry: put back in waiting
      job.status = 'waiting';
      job.startedAt = null;
      this._waiting.push(job);
    } else {
      // Permanently failed
      job.status = 'failed';
      job.finishedAt = Date.now();
      job.error = error;
      this._failed.push(job);

      // Keep failed list bounded
      if (this._failed.length > 500) {
        this._failed = this._failed.slice(-200);
      }
    }
  }

  /**
   * Get all waiting jobs
   * @returns {Array}
   */
  async getWaiting() {
    return [...this._waiting];
  }

  /**
   * Get all active jobs
   * @returns {Array}
   */
  async getActive() {
    return [...this._active];
  }

  /**
   * Get queue stats
   * @returns {object}
   */
  async getStats() {
    return {
      waiting: this._waiting.length,
      active: this._active.length,
      completed: this._completed.length,
      failed: this._failed.length,
    };
  }
}

// Singleton export
export const helpdeskQueue = new HelpdeskQueue();
export default helpdeskQueue;
