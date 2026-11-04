import {
  access,
  constants,
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { isBackupId } from './backup-files.js';

/** Where every new backup is also copied (M16.5), and how the last copy went. */
export interface CopySettings {
  folder: string | null;
  lastCopyAt: string | null;
  lastError: string | null;
}

const NONE: CopySettings = { folder: null, lastCopyAt: null, lastError: null };
/** Inside the chosen folder, so QBank never mixes with the owner's own files there. */
const SUBFOLDER = 'qbank-backups';

interface Paths {
  dataDir: string;
  /** The saved choice: `<dataDir>/backup-copy.json`. */
  file: string;
  /** This computer's backups: `<dataDir>/backups`. */
  backups: string;
}

const read = async (paths: Paths): Promise<CopySettings> =>
  readFile(paths.file, 'utf8').then(
    (text) => ({ ...NONE, ...(JSON.parse(text) as CopySettings) }),
    () => NONE,
  );

async function save(paths: Paths, settings: CopySettings) {
  await mkdir(paths.dataDir, { recursive: true, mode: 0o700 });
  await writeFile(paths.file, JSON.stringify(settings, null, 2), { mode: 0o600 });
}

/** `null` when the folder can take copies; else why not (shown to the owner). */
async function problemWith(paths: Paths, folder: string) {
  if (!isAbsolute(folder)) return 'not_absolute';
  if (!relative(paths.dataDir, resolve(folder)).startsWith('..')) return 'inside_data';
  const info = await stat(folder).catch(() => null);
  if (!info?.isDirectory()) return 'not_a_folder';
  return access(folder, constants.W_OK).then(
    () => null,
    () => 'not_writable',
  );
}

/** Copies one backup there and removes the copies whose backup is gone here. */
async function copy(paths: Paths, id: string, keptIds: readonly string[]) {
  const settings = await read(paths);
  if (!settings.folder) return;
  const target = join(settings.folder, SUBFOLDER);
  try {
    await mkdir(target, { recursive: true });
    await cp(join(paths.backups, id), join(target, id), { recursive: true });
    for (const name of await readdir(target))
      if (isBackupId(name) && !keptIds.includes(name))
        await rm(join(target, name), { recursive: true, force: true });
    await save(paths, { ...settings, lastCopyAt: new Date().toISOString(), lastError: null });
  } catch (error) {
    const lastError = (error as NodeJS.ErrnoException).code ?? 'copy_failed';
    await save(paths, { ...settings, lastError });
  }
}

/**
 * A folder off this disk's QBank data: typically one a cloud app syncs (Google Drive, iCloud,
 * OneDrive). QBank only copies files there; it never signs in to anything.
 */
export function createCopyTarget(dataDir: string) {
  const root = resolve(dataDir);
  const paths: Paths = {
    dataDir: root,
    file: join(root, 'backup-copy.json'),
    backups: join(root, 'backups'),
  };
  return {
    read: () => read(paths),
    problemWith: (folder: string) => problemWith(paths, folder),
    copy: (id: string, keptIds: readonly string[]) => copy(paths, id, keptIds),
    choose: (folder: string | null) => save(paths, { ...NONE, folder }),
  };
}

export type CopyTarget = ReturnType<typeof createCopyTarget>;
