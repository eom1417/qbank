import type { SourcesDeps } from './use-cases/deps.js';
import { LEASE_MS, runImport } from './use-cases/run-import.js';

/** Erases originals whose stated period is over (DEC-13); their questions stay. */
async function purgeExpired(deps: SourcesDeps) {
  for (const source of await deps.imports.expiredOriginals(deps.clock.now())) {
    await deps.imports.forgetOriginal(source.owner_id, source.id);
    if (source.blob_key) await deps.blobs.remove(source.blob_key);
  }
}

/** One worker slot: runs jobs until none is runnable for it; returns how many it ran. */
async function runSlot(deps: SourcesDeps): Promise<number> {
  let ran = 0;
  for (;;) {
    const job = await deps.imports.claimNext(deps.clock.now(), LEASE_MS);
    if (!job) return ran;
    await runImport(deps, job);
    ran += 1;
  }
}

/** Runs every runnable job now on every slot, after the original sweep; returns how many ran. */
async function drain(deps: SourcesDeps): Promise<number> {
  await purgeExpired(deps);
  const slots = Array.from({ length: deps.workers }, () => runSlot(deps));
  return (await Promise.all(slots)).reduce((sum, ran) => sum + ran, 0);
}

/**
 * Runs queued imports from the durable job table (M4.3), up to `deps.workers` at once and never
 * two of one account (M31, B2: the claim is fair across accounts). A job interrupted by a
 * restart is taken again when its lease runs out and resumes from its page checkpoints.
 */
export function createImportWorker(deps: SourcesDeps, pollMs = 2000) {
  let timer: NodeJS.Timeout | null = null;
  let sweeping = false;
  let active = 0;

  /** Starts a slot for each free worker; a slot ends when nothing is runnable for it. */
  function fill() {
    while (active < deps.workers) {
      active += 1;
      void runSlot(deps)
        .catch(() => 0)
        .finally(() => (active -= 1));
    }
  }

  async function tick() {
    if (sweeping) return;
    sweeping = true;
    try {
      await purgeExpired(deps);
    } finally {
      sweeping = false;
    }
    fill();
  }

  return {
    drain: () => drain(deps),
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
