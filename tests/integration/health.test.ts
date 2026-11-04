import { rmSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { pairedBrowser } from '../support/client.js';
import { runImports, uploadFile, useImportSuite } from '../support/imports.js';

// System health (M17.3) of a local install with no AI service: in the app only.
const { app, fixtures } = useImportSuite({ local: true });
let browser: Awaited<ReturnType<typeof pairedBrowser>>['browser'];

beforeAll(async () => {
  rmSync(`.data/test-app/${process.pid}/backups`, { recursive: true, force: true });
  ({ browser } = await pairedBrowser(app()));
});

const health = async () => (await browser.get('/api/health/details')).json();

describe('system health', () => {
  it('says what is set up, and asks for a backup until there is one', async () => {
    const first = await health();
    expect(first).toMatchObject({ aiHost: 'not_configured', backups: true, lastBackupAt: null });
    expect(first.problems).toEqual(['backup_old']);
    expect(first.diskFreeBytes).toBeGreaterThan(0);
    await browser.post('/api/backups');
    const after = await health();
    expect(after.problems).toEqual([]);
    expect(after.lastBackupAt).not.toBeNull();
  });

  it('names an import that failed this week', async () => {
    const bank = (await browser.post('/api/banks', { name: 'Health check' })).json();
    const job = (await uploadFile(app(), browser.cookie(), bank.id, fixtures().english)).json();
    // The original goes missing before the worker runs: the job fails, as a lost disk would.
    const source = await app
      .db()
      .selectFrom('source')
      .select('blob_key')
      .where('id', '=', job.sourceId)
      .executeTakeFirstOrThrow();
    await app
      .db()
      .updateTable('source')
      .set({ blob_key: null })
      .where('id', '=', job.sourceId)
      .execute();
    expect(source.blob_key).not.toBeNull();
    await runImports(app());
    const now = await health();
    expect(now.problems).toContain('import_failed');
    expect(now.lastFailedImport).toMatchObject({ fileName: 'english.pdf', stage: 'failed' });
  });

  it('is for the signed-in owner only', async () => {
    expect((await app().inject({ url: '/api/health/details' })).statusCode).toBe(401);
  });
});
