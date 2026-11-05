import { statfs } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { HealthResponse } from '../../../contracts/health.js';
import type { Clock } from '../../platform/clock.js';
import type { AiHostClient } from '../../platform/ai-host/client.js';
import type { RequireActor } from '../identity/index.js';
import { problemsOf, type HealthSnapshot } from './domain/problems.js';

interface HealthSettings {
  clock: Clock;
  dataDir: string;
  ai: AiHostClient;
  /** An account that never set up providers has none: its health never starts a host. */
  aiSetUp(accountId: string): Promise<boolean>;
  /** The AI service is set up for this install (it is optional). */
  aiConfigured: boolean;
  /** When the newest backup was made; absent where there are no backups (accounts mode). */
  latestBackup: (() => Promise<Date | null>) | null;
  lastFailure(ownerId: string, since: Date): Promise<HealthSnapshot['lastFailedImport']>;
  logFile: string | null;
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

type ProviderLike = { enabled?: boolean; status?: string; auth?: { status?: string } };

async function aiState(ai: AiHostClient, owner: string) {
  const state = await ai.read('/state', owner).catch(() => null);
  if (!state || state.status !== 200) return { aiHost: 'unreachable' as const, aiReady: 0 };
  const providers = ((state.body as { providers?: ProviderLike[] }).providers ?? []).filter(
    (p) => p.enabled && p.status === 'ready' && p.auth?.status === 'authenticated',
  );
  return { aiHost: 'reachable' as const, aiReady: providers.length };
}

async function aiHealth(settings: HealthSettings, ownerId: string) {
  if (!settings.aiConfigured) return { aiHost: 'not_configured' as const, aiReady: 0 };
  if (!(await settings.aiSetUp(ownerId))) return { aiHost: 'reachable' as const, aiReady: 0 };
  return aiState(settings.ai, `account:${ownerId}`);
}

/** Free space where the data lives (or its nearest folder that exists yet). */
async function freeBytes(dir: string): Promise<number | null> {
  for (let path = resolve(dir); ; path = dirname(path)) {
    const fs = await statfs(path).catch(() => null);
    if (fs) return fs.bavail * fs.bsize;
    if (dirname(path) === path) return null;
  }
}

/** System health for the owner (M17.3): AI, disk, backups and imports, gathered on request. */
async function readHealth(settings: HealthSettings, ownerId: string): Promise<HealthResponse> {
  const now = settings.clock.now();
  const snapshot: HealthSnapshot = {
    ...(await aiHealth(settings, ownerId)),
    diskFreeBytes: await freeBytes(settings.dataDir),
    backups: settings.latestBackup !== null,
    lastBackupAt: settings.latestBackup ? await settings.latestBackup() : null,
    lastFailedImport: await settings.lastFailure(ownerId, new Date(now.getTime() - WEEK_MS)),
  };
  const failed = snapshot.lastFailedImport;
  return {
    ...snapshot,
    lastBackupAt: snapshot.lastBackupAt?.toISOString() ?? null,
    lastFailedImport: failed ? { ...failed, at: failed.at?.toISOString() ?? null } : null,
    logFile: settings.logFile,
    problems: problemsOf(snapshot, now),
  };
}

export function registerHealth(
  app: FastifyInstance,
  settings: HealthSettings,
  requireActor: RequireActor,
) {
  app.get('/api/health/details', async (request) =>
    readHealth(settings, (await requireActor(request)).accountId),
  );
}
