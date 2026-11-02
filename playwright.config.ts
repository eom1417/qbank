import { existsSync, readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const API_PORT = '3100';
const WEB_PORT = 5180;

/** Dedicated E2E database: env (CI) or the git-ignored .env.local written by setup.sh. */
function e2eDatabaseUrl(): string {
  const fromEnv = process.env['E2E_DATABASE_URL'];
  if (fromEnv) return fromEnv;
  const file = existsSync('.env.local') ? readFileSync('.env.local', 'utf8') : '';
  const url = /^E2E_DATABASE_URL=(.+)$/m.exec(file)?.[1]?.trim();
  if (!url) throw new Error('E2E_DATABASE_URL is not set (env or .env.local)');
  return url;
}

const apiEnv = {
  DATABASE_URL: e2eDatabaseUrl(),
  QBANK_API_PORT: API_PORT,
  QBANK_COOKIE_SECURE: 'false',
  QBANK_TRUST_PROXY: 'true',
  QBANK_LOG_LEVEL: 'warn',
  QBANK_DEV_OUTBOX: 'true',
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
      command: 'node --import tsx src/server/migrate.ts && node --import tsx src/server/main.ts',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      env: apiEnv,
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
