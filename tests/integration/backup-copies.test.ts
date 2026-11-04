import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pairedBrowser } from '../support/client.js';
import { useTestApp } from '../support/test-app.js';

// A copy of every backup in a folder off the QBank data, such as a synced cloud folder (M16.5).
let now = new Date('2026-11-04T08:00:00Z');
const app = useTestApp({ local: true, clock: { now: () => now } });
const DATA = `.data/test-app/${process.pid}`;
const cloud = mkdtempSync(join(tmpdir(), 'qbank-cloud-'));
let browser: Awaited<ReturnType<typeof pairedBrowser>>['browser'];

beforeAll(async () => {
  rmSync(join(DATA, 'backups'), { recursive: true, force: true });
  rmSync(join(DATA, 'backup-copy.json'), { force: true });
  ({ browser } = await pairedBrowser(app()));
});
afterAll(() => rmSync(cloud, { recursive: true, force: true }));

const choose = (folder: string | null) => browser.put('/api/backups/copy', { folder });
const copies = () => readdirSync(join(cloud, 'qbank-backups')).sort();

describe('copying backups off this computer', () => {
  it('refuses a folder it cannot use, and says why', async () => {
    for (const [folder, problem] of [
      ['relative/path', 'not_absolute'],
      [join(cloud, 'missing'), 'not_a_folder'],
      [join(process.cwd(), DATA), 'inside_data'],
    ] as const) {
      const refused = await choose(folder);
      expect([refused.statusCode, refused.json().error.fields]).toEqual([400, { folder: problem }]);
    }
  });

  it('copies every new backup there, and drops copies of backups pruned here', async () => {
    expect((await choose(cloud)).json()).toMatchObject({ folder: cloud, lastError: null });
    const { id } = (await browser.post('/api/backups')).json();
    expect(copies()).toEqual([id]);
    expect((await browser.get('/api/backups/copy')).json().lastCopyAt).not.toBeNull();
    // 25 days: old backups are pruned here (sessions last 30 days in tests).
    for (let day = 1; day <= 25; day++) {
      now = new Date(now.getTime() + 24 * 3600_000);
      await app().backups.runDue();
    }
    const here = (await browser.get('/api/backups'))
      .json()
      .backups.map((b: { id: string }) => b.id)
      .sort();
    expect(here.length).toBeLessThan(26);
    expect(copies()).toEqual(here);
    expect((await choose(null)).json().folder).toBeNull();
  });
});
