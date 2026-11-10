import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createBackupStatusReader,
  parseBackupStatus,
} from '../../../src/server/capabilities/operator/adapters/backup-status-file.js';

// M32: status.json as scripts/server-backup.sh writes it; anything else means "no backup known".
const WRITTEN = '{"at":"2026-11-10T04:17:25Z","ok":true,"kept":11,"error":""}\n';

describe('the backup status file', () => {
  it('reads what the backup script writes, keeping only the shown fields', () => {
    expect(parseBackupStatus(WRITTEN)).toEqual({ at: '2026-11-10T04:17:25Z', ok: true, kept: 11 });
  });

  it('refuses text that is not a status', () => {
    for (const text of ['', 'not json', '[]', 'null', '{"at":"2026-11-10T04:17:25Z","ok":true}'])
      expect(parseBackupStatus(text), text).toBeNull();
    expect(parseBackupStatus('{"at":"2026-11-10T04:17:25Z","ok":"yes","kept":1}')).toBeNull();
    expect(parseBackupStatus('{"at":"2026-11-10T04:17:25Z","ok":true,"kept":-1}')).toBeNull();
  });

  it('knows no backup without a configured file, or before the file exists', async () => {
    expect(await createBackupStatusReader(null)()).toBeNull();
    const folder = mkdtempSync(join(tmpdir(), 'qbank-status-'));
    try {
      const read = createBackupStatusReader(join(folder, 'status.json'));
      expect(await read()).toBeNull();
      writeFileSync(join(folder, 'status.json'), WRITTEN);
      expect((await read())?.kept).toBe(11);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
