import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const API_PORT = '3100';
const WEB_PORT = 5180;
const AI_HOST_PORT = 3191;
/** Test-only secret between the E2E API and its own AI host; never used outside E2E. */
const AI_HOST_TOKEN = 'e2e-ai-host-token-not-a-secret-0001';
/** The AI host's own home, emptied per run: no account on this machine is read. */
const AI_HOST_HOME = resolve('.data/e2e-ai-host');

/** Dedicated E2E database: env (CI) or the git-ignored .env.local written by setup.sh. */
function e2eDatabaseUrl(): string {
  const fromEnv = process.env['E2E_DATABASE_URL'];
  if (fromEnv) return fromEnv;
  const file = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
  const url = /^E2E_DATABASE_URL=(.+)$/m.exec(file)?.[1]?.trim();
  if (!url) throw new Error('E2E_DATABASE_URL is not set (env or .env.local)');
  return url;
}

const LOCAL_API_PORT = '3102';
const LOCAL_WEB_PORT = 5181;
/** The local-mode install of tests/e2e/local-mode.spec.ts (PGlite, emptied per run). */
export const LOCAL_DATA_DIR = '.data/e2e-local';
export const LOCAL_WEB_URL = `http://127.0.0.1:${LOCAL_WEB_PORT}`;

const apiEnv = {
  QBANK_MODE: 'accounts',
  DATABASE_URL: e2eDatabaseUrl(),
  QBANK_API_PORT: API_PORT,
  QBANK_COOKIE_SECURE: 'false',
  QBANK_TRUST_PROXY: 'true',
  QBANK_LOG_LEVEL: 'warn',
  QBANK_DEV_OUTBOX: 'true',
  // Reset links point here, never at a request's Host (M17.4).
  QBANK_ALLOWED_ORIGINS: `http://127.0.0.1:${WEB_PORT}`,
  QBANK_AI_HOST_URL: `http://127.0.0.1:${AI_HOST_PORT}`,
  QBANK_AI_HOST_TOKEN: AI_HOST_TOKEN,
  // Uploaded originals of the E2E runs, apart from the development data.
  QBANK_DATA_DIR: '.data/e2e-app',
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${WEB_PORT}`, locale: 'ar-SA', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      // The vendored providers kit (Node 24, scripts/setup-ai-host.sh), signed in to nothing.
      command: `rm -rf ${AI_HOST_HOME} && /opt/node24/bin/node src/main.ts`,
      cwd: 'ai-host',
      port: AI_HOST_PORT,
      env: {
        PATH: process.env['PATH'] ?? '',
        HOME: `${AI_HOST_HOME}/home`,
        AI_HOST_HOME: `${AI_HOST_HOME}/kit`,
        AI_HOST_TOKEN,
        AI_HOST_PORT: String(AI_HOST_PORT),
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'node --import tsx src/server/migrate.ts && node --import tsx src/server/main.ts',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: apiEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Local mode (DEC-31): no sign-up; the browser pairs through Vite's proxy with the code.
      command: `rm -rf ${LOCAL_DATA_DIR} && node --import tsx src/server/main.ts`,
      url: `http://127.0.0.1:${LOCAL_API_PORT}/api/health`,
      env: {
        PATH: process.env['PATH'] ?? '',
        QBANK_MODE: 'local',
        QBANK_API_PORT: LOCAL_API_PORT,
        QBANK_DATA_DIR: LOCAL_DATA_DIR,
        QBANK_TRUST_PROXY: 'true',
        QBANK_LOG_LEVEL: 'warn',
        QBANK_WEB_DIR: 'none',
        // The providers screen is the install owner's: it is tested here, in local mode.
        QBANK_AI_HOST_URL: `http://127.0.0.1:${AI_HOST_PORT}`,
        QBANK_AI_HOST_TOKEN: AI_HOST_TOKEN,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${LOCAL_WEB_PORT} --strictPort`,
      url: LOCAL_WEB_URL,
      env: { QBANK_API_PORT: LOCAL_API_PORT },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { QBANK_API_PORT: API_PORT },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
