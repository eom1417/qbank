import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAiHostPool, type AiHostPool } from '../../../src/server/platform/ai-host/pool.js';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

let pools: { pool: AiHostPool; dir: string }[] = [];

function poolOf(max: number, idleMs = 60_000) {
  const dir = mkdtempSync(join(tmpdir(), 'qbank-pool-'));
  const pool = createAiHostPool({
    dir,
    node: process.execPath,
    entry: 'tests/support/fake-ai-host-process.mjs',
    max,
    idleMs,
    inherited: { PATH: process.env['PATH'] ?? '' },
  });
  pools.push({ pool, dir });
  return pool;
}

afterEach(async () => {
  for (const { pool, dir } of pools) {
    await pool.close();
    rmSync(dir, { recursive: true, force: true });
  }
  pools = [];
});

const accountServed = async (lease: { url: string; token: string }) => {
  const response = await fetch(new URL('/state', lease.url), {
    headers: { authorization: `Bearer ${lease.token}` },
  });
  return ((await response.json()) as { served: { account: string } }).served.account;
};

describe('the AI host pool (DEC-35)', () => {
  it('starts one host per account, reuses it, and refuses an id that is not an account', async () => {
    const pool = poolOf(3);
    const first = await pool.lease(A);
    const again = await pool.lease(A);
    expect(again.url).toBe(first.url);
    expect(await accountServed(first)).toBe(A);
    expect(await accountServed(await pool.lease(B))).toBe(B);
    await expect(pool.lease('../etc')).rejects.toThrow('ai_host_unavailable');
    expect(pool.running().sort()).toEqual([A, B]);
  });

  it('makes room by stopping the least recently used idle host, and is busy when none is idle', async () => {
    const pool = poolOf(2);
    const a = await pool.lease(A);
    const b = await pool.lease(B);
    await expect(pool.lease(C)).rejects.toThrow('ai_host_busy');
    a.release();
    await pool.lease(C);
    expect(pool.running().sort()).toEqual([B, C]);
    b.release();
  });

  it('stops a host left idle, and starts a fresh one when it is needed again', async () => {
    const pool = poolOf(2, 1);
    (await pool.lease(A)).release();
    await new Promise((done) => setTimeout(done, 1_500));
    expect(pool.running()).toEqual([]);
    expect(await accountServed(await pool.lease(A))).toBe(A);
  });

  it('starts a host again after it dies', async () => {
    const pool = poolOf(2);
    const first = await pool.lease(A);
    first.release();
    const auth = { authorization: `Bearer ${first.token}` };
    await fetch(new URL('/crash', first.url), { headers: auth }).catch(() => null);
    await new Promise((done) => setTimeout(done, 300));
    expect(pool.running()).toEqual([]);
    const second = await pool.lease(A);
    expect(second.token).not.toBe(first.token);
    expect(await accountServed(second)).toBe(A);
  });
});
