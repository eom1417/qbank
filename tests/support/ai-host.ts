import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { useTestApp } from './test-app.js';

/** The AI host needs Node >= 24.10 (scripts/setup-ai-host.sh installs it here). */
const NODE24 = process.env['QBANK_NODE24'] ?? '/opt/node24/bin/node';

const freePort = () =>
  new Promise<number>((done) => {
    const server = createServer().listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => done(typeof address === 'object' && address ? address.port : 0));
    });
  });

async function waitForHealth(url: string, token: string) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${url}/health`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((wait) => setTimeout(wait, 500));
  }
  throw new Error('ai-host did not start');
}

/**
 * A real ai-host for a test suite: its own temporary home (so no real account on this machine is
 * read or refreshed), a random port and token, and only PATH from this process.
 */
async function startAiHost(options: { binDir?: string } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'qbank-ai-host-'));
  const port = await freePort();
  const token = randomBytes(32).toString('hex');
  const child: ChildProcess = spawn(NODE24, [resolve('ai-host/src/main.ts')], {
    cwd: resolve('ai-host'),
    env: {
      // A test may put stand-in CLIs first on the PATH (cli-login).
      PATH: [options.binDir, process.env['PATH'] ?? ''].filter(Boolean).join(':'),
      HOME: home,
      AI_HOST_HOME: join(home, 'kit'),
      AI_HOST_TOKEN: token,
      AI_HOST_PORT: String(port),
    },
    stdio: 'ignore',
  });
  const url = `http://127.0.0.1:${port}`;
  await waitForHealth(url, token);
  const stop = () => {
    child.kill('SIGTERM');
    rmSync(home, { recursive: true, force: true });
  };
  return { url, token, stop };
}

/**
 * A local-mode test app on a real ai-host for the suite file (providers belong to the install's
 * owner). `binDir` names stand-in CLIs a hook registered before this one has written.
 */
export function useLocalAppOnAiHost(options: { binDir?: () => string } = {}) {
  let host: Awaited<ReturnType<typeof startAiHost>> | undefined;
  beforeAll(async () => {
    const binDir = options.binDir?.();
    host = await startAiHost(binDir ? { binDir } : {});
  }, 90_000);
  afterAll(() => host?.stop());
  return useTestApp({
    local: true,
    aiHost: () => ({ url: host?.url ?? '', token: host?.token ?? null }),
  });
}
