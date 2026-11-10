import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { ServerStatusResponse } from '../../src/contracts/operator.js';
import { ownerWithBank } from '../support/client.js';
import { signedInOperator } from '../support/operator.js';
import { useTestApp } from '../support/test-app.js';

// M32: the operator sees the last automatic backup, read from the backup service's status.json.
const folder = mkdtempSync(join(tmpdir(), 'qbank-status-'));
const statusFile = join(folder, 'status.json');
const app = useTestApp({ backupStatusFile: statusFile });
afterAll(() => rmSync(folder, { recursive: true, force: true }));
beforeEach(() => rmSync(statusFile, { force: true }));

async function operatorStatus() {
  const { browser } = await signedInOperator(app());
  const response = await browser.get('/api/operator/status');
  expect(response.statusCode).toBe(200);
  return ServerStatusResponse.parse(response.json());
}

describe('the server status for its operator (M32)', () => {
  it('reports no backup before the backup service wrote its first status', async () => {
    expect(await operatorStatus()).toEqual({ backup: null });
  });

  it('reports the last run, without the error text kept on the server', async () => {
    const status = { at: '2026-11-10T03:00:00Z', ok: false, kept: 9, error: 'pg_dump failed' };
    writeFileSync(statusFile, JSON.stringify(status));
    expect(await operatorStatus()).toEqual({
      backup: { at: '2026-11-10T03:00:00Z', ok: false, kept: 9 },
    });
  });

  it('reports no backup for a broken or half-written status file', async () => {
    writeFileSync(statusFile, '{"at":"2026-11-10T03:00:00Z","ok":tr');
    expect(await operatorStatus()).toEqual({ backup: null });
    writeFileSync(statusFile, JSON.stringify({ at: 'yesterday', ok: true, kept: 3 }));
    expect(await operatorStatus()).toEqual({ backup: null });
  });

  it('refuses the status to a normal account (403)', async () => {
    writeFileSync(statusFile, JSON.stringify({ at: '2026-11-10T03:00:00Z', ok: true, kept: 1 }));
    const { owner } = await ownerWithBank(app());
    const denied = await owner.get('/api/operator/status');
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('operator_only');
    expect(denied.body).not.toContain('2026-11-10');
  });
});
