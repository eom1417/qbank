import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { AppError } from '../errors/index.js';
import {
  startHostProcess,
  stopHostProcess,
  type HostLaunch,
  type HostProcess,
} from './host-process.js';

export interface AiHostPoolSettings extends HostLaunch {
  /** Each account's host folder is `<dir>/<accountId>`. */
  dir: string;
  max: number;
  idleMs: number;
}

/** A host in use: where to reach it, and the release that lets it go idle again. */
export interface HostLease {
  url: string;
  token: string;
  release(): void;
}

interface Entry {
  ready: Promise<HostProcess>;
  leases: number;
  lastUsed: number;
}

/** Only an account id names a folder: nothing like `..` or `/` can reach another one. */
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

interface Pool {
  settings: AiHostPoolSettings;
  hosts: Map<string, Entry>;
}

const folderOf = (pool: Pool, accountId: string) => join(pool.settings.dir, accountId);

async function stop(pool: Pool, accountId: string) {
  const entry = pool.hosts.get(accountId);
  if (!entry) return;
  pool.hosts.delete(accountId);
  const host = await entry.ready.catch(() => null);
  if (host) await stopHostProcess(host.child);
}

/** Room for one more host: the least recently used idle one is stopped, else busy. */
async function makeRoom(pool: Pool) {
  if (pool.hosts.size < pool.settings.max) return;
  const idle = [...pool.hosts].filter(([, entry]) => entry.leases === 0);
  idle.sort(([, a], [, b]) => a.lastUsed - b.lastUsed);
  const oldest = idle[0];
  if (!oldest) throw new AppError('ai_host_busy');
  await stop(pool, oldest[0]);
}

function start(pool: Pool, accountId: string): Entry {
  const ready = startHostProcess(pool.settings, folderOf(pool, accountId));
  const entry: Entry = { ready, leases: 0, lastUsed: Date.now() };
  pool.hosts.set(accountId, entry);
  const forget = () => {
    if (pool.hosts.get(accountId) === entry) pool.hosts.delete(accountId);
  };
  ready.then((host) => host.child.once('exit', forget), forget);
  return entry;
}

/** The account's running host, or a new one when there is room. */
async function entryOf(pool: Pool, accountId: string): Promise<Entry> {
  const running = pool.hosts.get(accountId);
  if (running) return running;
  await makeRoom(pool);
  const raced = pool.hosts.get(accountId);
  if (raced) return raced;
  if (pool.hosts.size >= pool.settings.max) throw new AppError('ai_host_busy');
  return start(pool, accountId);
}

async function lease(pool: Pool, accountId: string): Promise<HostLease> {
  if (!ACCOUNT_ID.test(accountId)) throw new AppError('ai_host_unavailable');
  const entry = await entryOf(pool, accountId);
  entry.leases += 1;
  const release = once(() => {
    entry.leases -= 1;
    entry.lastUsed = Date.now();
  });
  const host = await entry.ready.catch(() => null);
  if (!host) {
    release();
    throw new AppError('ai_host_unavailable');
  }
  return { url: host.url, token: host.token, release };
}

/** Stops every host nobody has used for the idle time. */
function sweepIdle(pool: Pool) {
  const now = Date.now();
  for (const [accountId, entry] of pool.hosts)
    if (entry.leases === 0 && now - entry.lastUsed >= pool.settings.idleMs)
      void stop(pool, accountId);
}

/**
 * One AI host per account (DEC-35), each in its own folder with its own token and port: started
 * when the account first needs it, stopped after it sits idle, at most `max` at once. A host
 * that dies is started again on the next request.
 */
export function createAiHostPool(settings: AiHostPoolSettings) {
  const pool: Pool = { settings, hosts: new Map() };
  const every = Math.max(1_000, Math.min(60_000, settings.idleMs / 4));
  const sweep = setInterval(() => sweepIdle(pool), every);
  sweep.unref();
  return {
    lease: (accountId: string) => lease(pool, accountId),
    /** Whether the account ever started its host (it has a folder): else it has no providers. */
    isSetUp: (accountId: string) =>
      ACCOUNT_ID.test(accountId)
        ? access(folderOf(pool, accountId)).then(
            () => true,
            () => false,
          )
        : Promise.resolve(false),
    /** Accounts whose host is running or starting now. */
    running: () => [...pool.hosts.keys()],
    /** Stops the account's host and deletes its folder: its sign-ins and keys (M22.4). */
    async forget(accountId: string) {
      if (!ACCOUNT_ID.test(accountId)) return;
      await stop(pool, accountId);
      await rm(folderOf(pool, accountId), { recursive: true, force: true });
    },
    async close() {
      clearInterval(sweep);
      await Promise.all([...pool.hosts.keys()].map((accountId) => stop(pool, accountId)));
    },
  };
}

export type AiHostPool = ReturnType<typeof createAiHostPool>;

function once(action: () => void) {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    action();
  };
}
