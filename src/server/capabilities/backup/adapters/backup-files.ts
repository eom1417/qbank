import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { TableRows } from './tables.js';

/** What a backup says about itself; its folder name is its id. */
export interface BackupMeta {
  format: 1;
  createdAt: string;
  reason: 'daily' | 'manual' | 'before_restore';
  schema: string;
  /** Rows per table, to preview a restore without reading every file. */
  counts: Record<string, number>;
}

interface Paths {
  /** `<dataDir>/backups`: one folder per backup. */
  root: string;
  /** `<dataDir>/blobs`: today's pictures and originals. */
  blobs: string;
}

const META = 'backup.json';
/** A backup id is the folder name this module made: a timestamp and a reason, nothing else. */
const ID = /^\d{8}-\d{6}-\d{3}-(daily|manual|before_restore)$/;

export const isBackupId = (id: string) => ID.test(id);

const stamp = (date: Date) =>
  date.toISOString().replace(/[-:]/g, '').replace('T', '-').replace('.', '-').slice(0, 19);

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/** A name no backup has yet: two made in the same millisecond step one apart. */
async function freeId(paths: Paths, meta: BackupMeta) {
  let time = new Date(meta.createdAt).getTime();
  const idAt = (at: number) => `${stamp(new Date(at))}-${meta.reason}`;
  while (await exists(join(paths.root, idAt(time)))) time += 1;
  return idAt(time);
}

async function write(paths: Paths, meta: BackupMeta, tables: Map<string, TableRows>) {
  const id = await freeId(paths, meta);
  const part = join(paths.root, `${id}.part`);
  await mkdir(join(part, 'tables'), { recursive: true, mode: 0o700 });
  for (const [table, rows] of tables)
    await writeFile(join(part, 'tables', `${table}.json`), JSON.stringify(rows), { mode: 0o600 });
  await cp(paths.blobs, join(part, 'blobs'), { recursive: true }).catch(() => undefined);
  await writeFile(join(part, META), JSON.stringify(meta, null, 2), { mode: 0o600 });
  await rename(part, join(paths.root, id));
  return id;
}

const readMeta = async (paths: Paths, id: string) =>
  JSON.parse(await readFile(join(paths.root, id, META), 'utf8')) as BackupMeta;

/** Every complete backup, newest first; a half-written one (`.part`) is not listed. */
async function list(paths: Paths) {
  const names = await readdir(paths.root).catch(() => [] as string[]);
  const found: { id: string; meta: BackupMeta }[] = [];
  for (const id of names.filter(isBackupId)) {
    const meta = await readMeta(paths, id).catch(() => null);
    if (meta) found.push({ id, meta });
  }
  return found.sort((a, b) => b.meta.createdAt.localeCompare(a.meta.createdAt));
}

async function readTables(paths: Paths, id: string, tables: readonly string[]) {
  const data = new Map<string, TableRows>();
  for (const table of tables) {
    const file = join(paths.root, id, 'tables', `${table}.json`);
    const text = await readFile(file, 'utf8').catch(() => null);
    if (text !== null) data.set(table, JSON.parse(text) as TableRows);
  }
  return data;
}

/** The backup's files take the place of today's; today's go only once the copy is complete. */
async function restoreFiles(paths: Paths, id: string) {
  const copy = join(paths.root, id, 'blobs');
  const incoming = `${paths.blobs}.incoming`;
  await rm(incoming, { recursive: true, force: true });
  if (await exists(copy)) await cp(copy, incoming, { recursive: true });
  else await mkdir(incoming, { recursive: true, mode: 0o700 });
  await rm(`${paths.blobs}.old`, { recursive: true, force: true });
  await rename(paths.blobs, `${paths.blobs}.old`).catch(() => undefined);
  await rename(incoming, paths.blobs);
  await rm(`${paths.blobs}.old`, { recursive: true, force: true });
}

/** Bytes on disk (a backup holds copies of the pictures and originals). */
async function sizeOf(path: string): Promise<number> {
  const info = await stat(path);
  if (!info.isDirectory()) return info.size;
  let total = 0;
  for (const entry of await readdir(path)) total += await sizeOf(join(path, entry));
  return total;
}

/** One folder per backup under `<dataDir>/backups`: meta, one JSON file per table, the files. */
export function createBackupFiles(dataDir: string) {
  const paths: Paths = { root: resolve(dataDir, 'backups'), blobs: resolve(dataDir, 'blobs') };
  return {
    write: (meta: BackupMeta, tables: Map<string, TableRows>) => write(paths, meta, tables),
    list: () => list(paths),
    readMeta: (id: string) => readMeta(paths, id),
    readTables: (id: string, tables: readonly string[]) => readTables(paths, id, tables),
    restoreFiles: (id: string) => restoreFiles(paths, id),
    size: (id: string) => sizeOf(join(paths.root, id)),
    remove: (id: string) => rm(join(paths.root, id), { recursive: true, force: true }),
  };
}

export type BackupFiles = ReturnType<typeof createBackupFiles>;
