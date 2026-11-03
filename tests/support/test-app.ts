import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'kysely';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll } from 'vitest';
import { buildApp } from '../../src/server/app.js';
import { migrateToLatest } from '../../src/server/migrator.js';
import type { Clock } from '../../src/server/platform/clock.js';
import { createDb, type Db } from '../../src/server/platform/db/index.js';

export const ORIGIN = 'http://qbank.test';

/** A fixed, obviously non-secret master key for the test database only. */
const TEST_MASTER_KEY = Buffer.alloc(32, 7);

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

interface TestAppOptions {
  clock?: Clock;
  aiHost?: () => { url: string; token: string | null };
}

async function startTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const clock = options.clock ?? { now: () => new Date() };
  const db = createDb(testDatabaseUrl());
  await migrateToLatest(db);
  // Test database only (TEST_DATABASE_URL); every owned table cascades from account.
  await sql`truncate table account cascade`.execute(db);
  const config = {
    databaseUrl: '',
    host: '127.0.0.1',
    port: 0,
    cookieSecure: false,
    trustProxy: false,
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
    masterKey: TEST_MASTER_KEY,
    // Tests reach the fake provider on 127.0.0.1; production keeps this off (SSRF guard).
    ai: {
      allowPrivateUrls: true,
      // Stand-ins for the official CLIs (tests/fixtures/fake-cli), so no real account is used.
      claudeBin: resolve('tests/fixtures/fake-cli/claude.mjs'),
      codexBin: resolve('tests/fixtures/fake-cli/codex.mjs'),
      // One directory per test process: each app clears its own at startup.
      workDir: `.data/test-ai-work/${process.pid}`,
      cliEnv: { PATH: process.env['PATH'] ?? '' },
    },
  };
  const app = buildApp({ config, db, clock });
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
