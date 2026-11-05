import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { refreshSignIns } from '../../../src/server/platform/ai-host/keep-alive.js';
import { createAiHostPool } from '../../../src/server/platform/ai-host/pool.js';

const AWAY = '00000000-0000-4000-8000-0000000000a1';
const ACTIVE = '00000000-0000-4000-8000-0000000000a2';
const NEVER = '00000000-0000-4000-8000-0000000000a3';

const dir = mkdtempSync(join(tmpdir(), 'qbank-refresh-'));
const pool = createAiHostPool({
  dir,
  node: process.execPath,
  entry: 'tests/support/fake-ai-host-process.mjs',
  max: 5,
  idleMs: 60_000,
  inherited: { PATH: process.env['PATH'] ?? '' },
});
afterAll(async () => {
  await pool.close();
  rmSync(dir, { recursive: true, force: true });
});

const requests = (account: string) => {
  const log = join(dir, account, 'requests.log');
  return existsSync(log) ? readFileSync(log, 'utf8') : '';
};

describe('renewing sign-ins while accounts are away (DEC-35)', () => {
  it('refreshes each linked account that is away, then stops its host again', async () => {
    mkdirSync(join(dir, AWAY));
    const active = await pool.lease(ACTIVE);
    expect(await refreshSignIns(pool)).toBe(1);
    expect(requests(AWAY)).toMatch(/server\.refreshProviders/);
    expect(requests(ACTIVE)).toBe('');
    expect(existsSync(join(dir, NEVER))).toBe(false);
    expect(pool.running()).toEqual([ACTIVE]);
    active.release();
  });
});
