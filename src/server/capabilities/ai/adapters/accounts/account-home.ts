import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { AccountProvider } from '../../../../../contracts/ai.js';

/**
 * How one provider's official CLI keeps its subscription login on disk. The credential is the
 * opaque JSON the app seals in the database; it is written to a private home only for a run.
 */
export interface AccountSpec {
  provider: AccountProvider;
  /** The CLI's config directory inside the private home. */
  homeName: string;
  /** Points the CLI at the private home. */
  envFor(root: string, home: string): Record<string, string>;
  write(home: string, credential: string): Promise<void>;
  /** The login the CLI left in the home (possibly refreshed); null when there is none. */
  read(home: string): Promise<string | null>;
}

export interface AccountHome {
  root: string;
  home: string;
  env: NodeJS.ProcessEnv;
}

function cliEnv(spec: AccountSpec, baseEnv: Record<string, string>, root: string, home: string) {
  return { ...baseEnv, TERM: 'xterm-256color', HOME: root, ...spec.envFor(root, home) };
}

export async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export const writePrivate = (path: string, data: string) => writeFile(path, data, { mode: 0o600 });

/** Creates a private (0700) home under `workDir`, outside /tmp so the CLIs accept it. */
/** Where private homes live and the only environment the CLIs get (from config). */
export interface HomeSettings {
  workDir: string;
  cliEnv: Record<string, string>;
}

export async function openAccountHome(
  settings: HomeSettings,
  spec: AccountSpec,
): Promise<AccountHome> {
  const { workDir } = settings;
  await mkdir(workDir, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(join(resolve(workDir), `${spec.provider}-`));
  await chmod(root, 0o700);
  const home = join(root, spec.homeName);
  await mkdir(home, { mode: 0o700 });
  return { root, home, env: cliEnv(spec, settings.cliEnv, root, home) };
}

// A CLI that is being stopped may still be writing; retry instead of failing the request.
const REMOVE = { recursive: true, force: true, maxRetries: 5, retryDelay: 200 } as const;

/** Removes a private home. Never throws: a leftover is cleared at the next startup anyway. */
export const closeAccountHome = (home: AccountHome) => rm(home.root, REMOVE).catch(() => undefined);

/**
 * Removes private homes a stopped server left behind (a crash mid-run would otherwise leave a
 * plain copy of a login on disk). Called once at startup.
 */
export const clearAccountHomes = (workDir: string) => rm(workDir, REMOVE).catch(() => undefined);

/**
 * Runs `work` with the credential in a fresh private home, then returns what the CLI left
 * there (tokens may have been refreshed) and removes the home whatever happened.
 */
export async function withAccountHome<T>(
  settings: HomeSettings,
  spec: AccountSpec,
  credential: string,
  work: (home: AccountHome) => Promise<T>,
): Promise<{ value: T; credential: string | null }> {
  const home = await openAccountHome(settings, spec);
  try {
    await spec.write(home.home, credential);
    const value = await work(home);
    return { value, credential: await spec.read(home.home) };
  } finally {
    await closeAccountHome(home);
  }
}
