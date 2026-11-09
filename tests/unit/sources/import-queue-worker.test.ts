import { describe, expect, it } from 'vitest';
import type { JobRow } from '../../../src/server/capabilities/sources/adapters/import-repository.js';
import type { SourcesDeps } from '../../../src/server/capabilities/sources/use-cases/deps.js';
import { createImportWorker } from '../../../src/server/capabilities/sources/worker.js';

/**
 * A queue of `jobs` whose source is gone, so each run ends at once as `source_missing`. It
 * records how many jobs ran at the same time.
 */
function fakeQueue(jobs: number, workers: number, pollMs = 2000) {
  const waiting = Array.from({ length: jobs }, (_, i) => ({
    id: `job-${i}`,
    owner_id: `acc-${i}`,
  }));
  const seen = { running: 0, most: 0, ran: 0 };
  const imports = {
    expiredOriginals: async () => [],
    claimNext: async () => {
      const job = waiting.shift();
      if (job) seen.most = Math.max(seen.most, ++seen.running);
      return job as JobRow | undefined;
    },
    findSource: async () => undefined,
    update: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      seen.running -= 1;
      seen.ran += 1;
    },
  };
  const deps = {
    imports,
    workers,
    clock: { now: () => new Date() },
    log: { error: () => undefined },
  } as unknown as SourcesDeps;
  return { worker: createImportWorker(deps, pollMs), seen };
}

describe('the import worker runs a bounded number of imports at once (M31, B2)', () => {
  it('runs up to `workers` imports together and drains every runnable job', async () => {
    const { worker, seen } = fakeQueue(5, 2);
    expect(await worker.drain()).toBe(5);
    expect(seen).toMatchObject({ most: 2, ran: 5, running: 0 });
  });

  it('with one worker, runs one import at a time', async () => {
    const { worker, seen } = fakeQueue(3, 1);
    expect(await worker.drain()).toBe(3);
    expect(seen.most).toBe(1);
  });

  it('returns zero when nothing is waiting', async () => {
    const { worker } = fakeQueue(0, 2);
    expect(await worker.drain()).toBe(0);
  });

  it('in the background, keeps every worker busy and never more', async () => {
    const { worker, seen } = fakeQueue(6, 3, 5);
    worker.start();
    await expect.poll(() => seen.ran, { timeout: 2000 }).toBe(6);
    worker.stop();
    expect(seen.most).toBe(3);
  });
});
