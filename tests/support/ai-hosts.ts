import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';
import type { createClient } from './client.js';
import { useReviewSuite } from './questions.js';

type Browser = ReturnType<typeof createClient>;

/**
 * A suite whose accounts each get their own AI host process (DEC-35), the fake one in
 * fake-ai-host-process.mjs, in a temporary folder. Call it at the top of the file.
 */
export function usePerAccountHosts(max = 5) {
  const dir = mkdtempSync(join(tmpdir(), 'qbank-ai-hosts-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const suite = useReviewSuite({
    aiHosts: {
      mode: 'per_account',
      dir,
      node: process.execPath,
      entry: 'tests/support/fake-ai-host-process.mjs',
      max,
      idleMs: 60_000,
      inherited: { PATH: process.env['PATH'] ?? '' },
    },
  });
  /** What the account's own host says it serves. */
  const served = async (owner: Browser) => {
    const state = (await owner.get('/api/providers/state')).json();
    return state.served as { account: string; home: string; environment: string[] };
  };
  /** Every request the account's host received besides state and drivers. */
  const requestsOf = (account: string) => {
    const log = join(dir, account, 'requests.log');
    return existsSync(log) ? readFileSync(log, 'utf8') : '';
  };
  return { ...suite, dir, served, requestsOf };
}
