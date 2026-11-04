import { rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, useTestApp } from '../support/test-app.js';

// Full local backups (M17.2): automatic, on demand, previewed and restored all or nothing.
let now = new Date('2026-11-04T08:00:00Z');
const app = useTestApp({ local: true, clock: { now: () => now } });
const DATA = `.data/test-app/${process.pid}`;
let cookie = '';

const call = (method: 'GET' | 'POST', url: string, payload?: object) =>
  app().inject({
    method,
    url,
    ...(payload ? { payload } : {}),
    headers: { cookie, host: 'localhost:3000', origin: ORIGIN },
    remoteAddress: '127.0.0.1',
  });
const banks = async () =>
  (await call('GET', '/api/banks')).json().banks.map((b: { name: string }) => b.name);

beforeAll(async () => {
  rmSync(join(DATA, 'backups'), { recursive: true, force: true });
  const paired = await call('POST', '/api/local/pair', {});
  cookie = `qb_session=${paired.cookies.find((c) => c.name === 'qb_session')?.value}`;
});

describe('backups of the whole install', () => {
  it('backs up, then restores everything as it was, with a safety backup first', async () => {
    await call('POST', '/api/banks', { name: 'Cardiology' });
    const blobs = join(DATA, 'blobs', 'ab');
    rmSync(blobs, { recursive: true, force: true });
    (await import('node:fs')).mkdirSync(blobs, { recursive: true });
    writeFileSync(join(blobs, 'ab-file'), 'original picture');
    const made = await call('POST', '/api/backups');
    expect(made.statusCode).toBe(201);
    const { id } = made.json();

    await call('POST', '/api/banks', { name: 'Nephrology' });
    writeFileSync(join(blobs, 'ab-file'), 'changed');
    const preview = (await call('GET', `/api/backups/${id}/preview`)).json();
    expect(preview).toMatchObject({ backup: { banks: 1 }, now: { banks: 2 }, compatible: true });

    now = new Date(now.getTime() + 60_000);
    const restored = await call('POST', `/api/backups/${id}/restore`, { confirm: true });
    expect(restored.statusCode).toBe(200);
    expect(await banks()).toEqual(['Cardiology']);
    expect(readFileSync(join(blobs, 'ab-file'), 'utf8')).toBe('original picture');
    const list = (await call('GET', '/api/backups')).json().backups;
    expect(list.map((b: { reason: string }) => b.reason)).toEqual(['before_restore', 'manual']);
    // The safety backup undoes the restore.
    await call('POST', `/api/backups/${restored.json().safety}/restore`, { confirm: true });
    expect((await banks()).sort()).toEqual(['Cardiology', 'Nephrology']);
  });
});

describe('automatic backups and their limits', () => {
  it('makes one automatic backup a day and keeps 7 newest plus one per earlier week', async () => {
    rmSync(join(DATA, 'backups'), { recursive: true, force: true });
    for (let day = 0; day < 40; day++) {
      now = new Date(Date.UTC(2026, 9, 1 + day, 3));
      await app().backups.runDue();
      await app().backups.runDue();
    }
    const list = (await call('GET', '/api/backups')).json().backups;
    expect(list.every((b: { reason: string }) => b.reason === 'daily')).toBe(true);
    expect(list).toHaveLength(11);
  });

  it('asks for confirmation, refuses unknown ids and a backup from a newer QBank', async () => {
    const { id } = (await call('POST', '/api/backups')).json();
    expect((await call('POST', `/api/backups/${id}/restore`, {})).statusCode).toBe(400);
    expect((await call('GET', '/api/backups/../../etc/preview')).statusCode).toBe(404);
    const meta = join(DATA, 'backups', id, 'backup.json');
    writeFileSync(
      meta,
      JSON.stringify({ ...JSON.parse(readFileSync(meta, 'utf8')), schema: '999999' }),
    );
    expect((await call('GET', `/api/backups/${id}/preview`)).json().compatible).toBe(false);
    const refused = await call('POST', `/api/backups/${id}/restore`, { confirm: true });
    expect([refused.statusCode, refused.json().error.code]).toEqual([409, 'backup_too_new']);
  });
});
