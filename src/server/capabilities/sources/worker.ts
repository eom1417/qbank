import type { SourcesDeps } from './use-cases/deps.js';
import { LEASE_MS, runImport } from './use-cases/run-import.js';

/**
 * Runs queued imports one at a time from the durable job table (M4.3). A job interrupted by a
 * restart is taken again when its lease runs out and resumes from its page checkpoints.
 */
export function createImportWorker(deps: SourcesDeps, pollMs = 2000) {
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  /** Runs every runnable job now; returns how many ran (tests and the poller use it). */
  async function drain(): Promise<number> {
    let ran = 0;
    for (;;) {
      const job = await deps.imports.claimNext(deps.clock.now(), LEASE_MS);
      if (!job) return ran;
      await runImport(deps, job);
      ran += 1;
    }
  }

  async function tick() {
    if (running) return;
    running = true;
    try {
      await drain();
    } finally {
      running = false;
    }
  }

  return {
    drain,
    start() {
      timer ??= setInterval(() => void tick().catch(() => undefined), pollMs);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
