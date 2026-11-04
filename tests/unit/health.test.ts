import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { problemsOf } from '../../src/server/capabilities/health/domain/problems.js';
import {
  createRotatingLog,
  requestForLog,
} from '../../src/server/platform/logging/rotating-file.js';

const now = new Date('2026-11-04T12:00:00Z');
const healthy = {
  aiHost: 'reachable' as const,
  aiReady: 1,
  diskFreeBytes: 50 * 1024 ** 3,
  backups: true,
  lastBackupAt: new Date(now.getTime() - 3600_000),
  lastFailedImport: null,
};

describe('what needs attention (M17.3)', () => {
  it('nothing when all works, and AI that is not set up is not a problem', () => {
    expect(problemsOf(healthy, now)).toEqual([]);
    expect(problemsOf({ ...healthy, aiHost: 'not_configured', aiReady: 0 }, now)).toEqual([]);
    expect(problemsOf({ ...healthy, aiReady: 0 }, now)).toEqual([]);
  });

  it('names each problem: AI down, low disk, a late backup, a failed import', () => {
    const late = new Date(now.getTime() - 49 * 3600_000);
    const failed = { fileName: 'a.pdf', stage: 'failed', at: now };
    expect(
      problemsOf(
        {
          ...healthy,
          aiHost: 'unreachable',
          diskFreeBytes: 10,
          lastBackupAt: late,
          lastFailedImport: failed,
        },
        now,
      ),
    ).toEqual(['ai_unreachable', 'disk_low', 'backup_old', 'import_failed']);
    expect(problemsOf({ ...healthy, backups: false, lastBackupAt: null }, now)).toEqual([]);
  });
});

describe("QBank's log (M17.3)", () => {
  it('logs the path of a request, never its query', () => {
    expect(requestForLog({ method: 'GET', url: '/api/search?q=patient+name' })).toEqual({
      method: 'GET',
      path: '/api/search',
    });
  });

  it('rotates past 5 MB and keeps four older files at most', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qbank-log-'));
    const log = createRotatingLog(dir);
    const write = process.stdout.write;
    process.stdout.write = () => true;
    const line = `${'x'.repeat(1023)}\n`;
    for (let i = 0; i < 6 * 5 * 1024 + 10; i++) log.write(line);
    process.stdout.write = write;
    await new Promise((done) => setTimeout(done, 200));
    expect(readdirSync(join(dir, 'logs')).sort()).toEqual([
      'qbank.log',
      'qbank.log.1',
      'qbank.log.2',
      'qbank.log.3',
      'qbank.log.4',
    ]);
    expect(readFileSync(log.file, 'utf8').length).toBeLessThanOrEqual(5 * 1024 * 1024);
    rmSync(dir, { recursive: true, force: true });
  });
});
