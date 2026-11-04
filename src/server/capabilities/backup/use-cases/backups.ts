import type { Clock } from '../../../platform/clock.js';
import type { Db } from '../../../platform/db/index.js';
import { AppError } from '../../../platform/errors/index.js';
import { isBackupId, type BackupFiles, type BackupMeta } from '../adapters/backup-files.js';
import {
  countRows,
  dumpTable,
  replaceAll,
  schemaVersion,
  tablesInOrder,
} from '../adapters/tables.js';
import { backupDue, backupsToKeep } from '../domain/retention.js';

export interface BackupDeps {
  db: Db;
  clock: Clock;
  files: BackupFiles;
}

/** What a person recognises in a backup: banks, questions, sessions and pictures. */
const summary = (counts: Record<string, number>) => ({
  banks: counts['bank'] ?? 0,
  questions: counts['question'] ?? 0,
  sessions: counts['study_session'] ?? 0,
  pictures: counts['media'] ?? 0,
});

/** A full copy of this install now: every table's rows, and the pictures and originals. */
export async function createBackup(deps: BackupDeps, reason: BackupMeta['reason']) {
  const tables = await tablesInOrder(deps.db);
  const data = new Map<string, Record<string, unknown>[]>();
  for (const table of tables) data.set(table, await dumpTable(deps.db, table));
  const meta: BackupMeta = {
    format: 1,
    createdAt: deps.clock.now().toISOString(),
    reason,
    schema: await schemaVersion(deps.db),
    counts: Object.fromEntries([...data].map(([table, rows]) => [table, rows.length])),
  };
  const id = await deps.files.write(meta, data);
  // Before a restore nothing is pruned: the backup being restored may be an old one.
  if (reason !== 'before_restore') await prune(deps);
  return id;
}

/** Old backups beyond the 7 newest and one per earlier week (4 weeks) are removed. */
async function prune(deps: BackupDeps) {
  const backups = await deps.files.list();
  const keep = backupsToKeep(backups.map((b) => new Date(b.meta.createdAt)));
  for (const [index, backup] of backups.entries())
    if (!keep.has(index)) await deps.files.remove(backup.id);
}

/** Makes today's automatic backup when it is due; quiet otherwise. */
export async function backupIfDue(deps: BackupDeps) {
  const [newest] = await deps.files.list();
  if (backupDue(newest ? new Date(newest.meta.createdAt) : null, deps.clock.now()))
    await createBackup(deps, 'daily');
}

export async function listBackups(deps: BackupDeps) {
  const backups = await deps.files.list();
  return {
    backups: await Promise.all(
      backups.map(async ({ id, meta }) => ({
        id,
        createdAt: meta.createdAt,
        reason: meta.reason,
        sizeBytes: await deps.files.size(id),
        ...summary(meta.counts),
      })),
    ),
  };
}

async function knownBackup(deps: BackupDeps, id: string) {
  const meta = isBackupId(id) ? await deps.files.readMeta(id).catch(() => null) : null;
  if (!meta) throw new AppError('not_found');
  return meta;
}

/** What a restore would bring back, against what is here now, before anything changes. */
export async function previewRestore(deps: BackupDeps, id: string) {
  const meta = await knownBackup(deps, id);
  const now: Record<string, number> = {};
  for (const table of ['bank', 'question', 'study_session', 'media'])
    now[table] = await countRows(deps.db, table);
  const compatible = meta.schema <= (await schemaVersion(deps.db));
  return { backup: summary(meta.counts), now: summary(now), createdAt: meta.createdAt, compatible };
}

/**
 * Brings the whole install back to the backup (M17.2). Today's state is backed up first, so a
 * restore can itself be undone. A backup from a newer QBank is refused: its data may not fit.
 */
export async function restoreBackup(deps: BackupDeps, id: string) {
  const meta = await knownBackup(deps, id);
  if (meta.schema > (await schemaVersion(deps.db))) throw new AppError('backup_too_new');
  const safety = await createBackup(deps, 'before_restore');
  const tables = await tablesInOrder(deps.db);
  await replaceAll(deps.db, tables, await deps.files.readTables(id, tables));
  await deps.files.restoreFiles(id);
  return { restored: id, safety };
}
