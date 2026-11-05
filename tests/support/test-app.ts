import { existsSync, readFileSync } from 'node:fs';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { migrateToLatest } from '../../src/server/migrator.js';
import type { Clock } from '../../src/server/platform/clock.js';
import { createDb, type Db } from '../../src/server/platform/db/index.js';

export const ORIGIN = 'http://qbank.test';

function testDatabaseUrl(): string {
  const fromEnv = process.env['TEST_DATABASE_URL'];
  if (fromEnv) return fromEnv;
  const file = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
  const match = /^TEST_DATABASE_URL=(.+)$/m.exec(file);
  if (!match?.[1]) throw new Error('TEST_DATABASE_URL is not set (env or .env.local)');
  return match[1].trim();
}

interface TestApp {
  app: FastifyInstance;
  db: Db;
  close(): Promise<void>;
}

/** A real app on the dedicated test database, migrated and emptied before each suite. */
/** No AI host unless a suite starts one (tests/support/ai-host.ts). */
const NO_AI_HOST = { url: 'http://127.0.0.1:9', token: null };

/** The pairing code of a local-mode test app (fixed, not a secret). */
export const TEST_PAIRING_TOKEN = 'test-pairing-code-not-a-secret-0001';

interface TestAppOptions {
  clock?: Clock;
  /** Local mode (DEC-31) instead of accounts mode. */
  local?: boolean;
  /** Local mode that pairs this computer only with the code too. */
  requirePairingCode?: boolean;
  /** A built web app for the API to serve. */
  webDir?: string;
  aiHost?: () => { url: string; token: string | null };
}

async function startTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const clock = options.clock ?? { now: () => new Date() };
  const db = createDb(testDatabaseUrl());
  await migrateToLatest(db);
  // Test database only (TEST_DATABASE_URL); every owned table cascades from account.
  await sql`truncate table account cascade`.execute(db);
  const config = {
    mode: options.local ? ('local' as const) : ('accounts' as const),
    databaseUrl: '',
    host: '127.0.0.1',
    port: 0,
    cookieSecure: false,
    trustProxy: false,
    requirePairingCode: options.requirePairingCode ?? false,
    devOutbox: true,
    allowedOrigins: [ORIGIN],
    sessionTtlDays: 30,
    logLevel: 'silent' as const,
    imports: {
      dataDir: `.data/test-app/${process.pid}`,
      maxUploadBytes: 20 * 1024 * 1024,
      maxPages: 1500,
      // Tests run the import worker themselves (tests/support/imports.ts).
      worker: false,
      originalRetentionDays: 7,
    },
    aiHost: options.aiHost?.() ?? NO_AI_HOST,
    webDir: options.webDir ?? null,
  };
  const pairingToken = options.local ? TEST_PAIRING_TOKEN : null;
  // No test reaches the web: a source link "opens" unless its URL says it is dead.
  const checkLink = (url: string) => Promise.resolve(!url.includes('dead'));
  const app = buildApp({ config, db, clock, pairingToken, checkLink });
  await app.ready();
  const close = async () => {
    await app.close();
    await db.destroy();
  };
  return { app, db, close };
}

/** Starts one test app for the current suite file; call the returned getter inside tests. */
export function useTestApp(options: TestAppOptions = {}) {
  let current: TestApp | undefined;
  beforeAll(async () => {
    current = await startTestApp(options);
  });
  afterAll(() => current?.close());
  const started = () => {
    if (!current) throw new Error('test app not started');
    return current;
  };
  /** The test database itself, for checks the API must never expose (e.g. sealed keys). */
  const db = (): Db => started().db;
  return Object.assign((): FastifyInstance => started().app, { db });
}

/**
 * A local-mode app on a clock the test moves (backups, schedules), and its data folder.
 * `clock.advance(ms)` moves time on; `clock.now()` is the time the app sees.
 */
export function useLocalAppOnClock(start: Date) {
  let now = start;
  const clock = {
    now: () => now,
    advance: (ms: number) => void (now = new Date(now.getTime() + ms)),
    set: (date: Date) => void (now = date),
  };
  return {
    app: useTestApp({ local: true, clock }),
    clock,
    dataDir: `.data/test-app/${process.pid}`,
  };
}
