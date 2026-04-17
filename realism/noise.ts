// realism/noise.ts — Latency, jitter, drop simulation for realistic timing

export type NoiseConfig = {
  baseLatencyMs: number;
  jitterMs: number;
  dropRate: number; // 0..1
  errorRate: number; // 0..1 (soft errors)
  retryPolicy: {
    retries: number;
    backoffMs: number;
    factor: number;
  };
  seed?: number;
};

export class Noise {
  private seed: number;

  constructor(private cfg: NoiseConfig) {
    this.seed = cfg.seed ?? Date.now();
  }

  /**
   * Deterministic RNG (LCG) → reproducible in tests.
   */
  private rnd(): number {
    this.seed = (1664525 * this.seed + 1013904223) % 2 ** 32;
    return this.seed / 2 ** 32;
  }

  /**
   * Calculate realistic latency for a command.
   */
  latency(): number {
    return this.cfg.baseLatencyMs + Math.floor(this.rnd() * this.cfg.jitterMs);
  }

  /**
   * Should this request be dropped (simulating network issues)?
   */
  shouldDrop(): boolean {
    return this.rnd() < this.cfg.dropRate;
  }

  /**
   * Should this request produce a soft error (retryable)?
   */
  shouldError(): boolean {
    return this.rnd() < this.cfg.errorRate;
  }

  /**
   * Execute a function with retry logic and exponential backoff.
   */
  async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    let delay = this.cfg.retryPolicy.backoffMs;

    while (true) {
      try {
        if (this.shouldDrop()) {
          throw new Error("EHOSTUNREACH");
        }

        const res = await fn();

        if (this.shouldError()) {
          throw new Error("EAGAIN");
        }

        return res;
      } catch (e) {
        if (attempt >= this.cfg.retryPolicy.retries) {
          throw e;
        }

        await this.sleep(delay);
        delay = Math.floor(delay * this.cfg.retryPolicy.factor);
        attempt++;
      }
    }
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

/**
 * Default noise config for production-like simulation.
 */
export function createDefaultNoise(seed?: number): Noise {
  return new Noise({
    baseLatencyMs: 50,
    jitterMs: 100,
    dropRate: 0.01, // 1% drop rate
    errorRate: 0.02, // 2% soft error rate
    retryPolicy: {
      retries: 3,
      backoffMs: 100,
      factor: 2,
    },
    seed,
  });
}

/**
 * Create a noise config for testing (deterministic, no drops/errors).
 */
export function createTestNoise(seed = 42): Noise {
  return new Noise({
    baseLatencyMs: 10,
    jitterMs: 20,
    dropRate: 0,
    errorRate: 0,
    retryPolicy: {
      retries: 0,
      backoffMs: 0,
      factor: 1,
    },
    seed,
  });
}

/**
 * Sleep utility for async transitions.
 */
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Generate jitter value.
 */
export const jitter = (maxMs: number) => Math.floor(Math.random() * maxMs);
