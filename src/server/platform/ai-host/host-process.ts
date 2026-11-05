import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, open } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';

/** How to start one AI host process: the Node to run it with, its entry file, its variables. */
export interface HostLaunch {
  node: string;
  entry: string;
  /**
   * The only server variables it inherits (config's `inherited`). QBank's own settings
   * (database, secrets) never reach it, nor the provider CLIs it starts.
   */
  inherited: Record<string, string>;
}

/** One running AI host: where it listens, its own token, and its process. */
export interface HostProcess {
  url: string;
  token: string;
  child: ChildProcess;
}

const READY_TIMEOUT_MS = 30_000;

/** A free loopback port, asked of the system (released just before the host takes it). */
function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once('error', fail);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() =>
        typeof address === 'object' && address ? done(address.port) : fail(new Error('no port')),
      );
    });
  });
}

function hostEnvironment(launch: HostLaunch, home: string, port: number, token: string) {
  return {
    ...launch.inherited,
    HOME: join(home, 'home'),
    AI_HOST_HOME: home,
    AI_HOST_PORT: String(port),
    AI_HOST_TOKEN: token,
    AI_HOST_EXIT_WITH_PARENT: '1',
  };
}

/** Waits until the host answers `/health` with its token, or fails when it exits or stalls. */
async function untilReady(host: HostProcess): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (host.child.exitCode !== null || host.child.signalCode !== null)
      throw new Error('AI host exited while starting');
    const ok = await fetch(new URL('/health', host.url), {
      headers: { authorization: `Bearer ${host.token}` },
    })
      .then((response) => response.ok)
      .catch(() => false);
    if (ok) return;
    await new Promise((done) => setTimeout(done, 150));
  }
  throw new Error('AI host did not start in time');
}

/**
 * Starts an AI host for one folder: its kit home is `home`, and the provider CLIs it runs keep
 * their sign-ins in `home/home` (their HOME). The folder is private to the server's user (0700).
 */
export async function startHostProcess(launch: HostLaunch, home: string): Promise<HostProcess> {
  await mkdir(join(home, 'home'), { recursive: true, mode: 0o700 });
  const port = await freePort();
  const token = randomBytes(32).toString('hex');
  const log = await open(join(home, 'host.log'), 'a', 0o600);
  const child = spawn(launch.node, [resolve(launch.entry)], {
    cwd: home,
    env: hostEnvironment(launch, home, port, token),
    // The host's stdin stays open while this server runs: it exits when the pipe closes.
    stdio: ['pipe', log.fd, log.fd],
  });
  await log.close();
  const host = { url: `http://127.0.0.1:${port}`, token, child };
  try {
    await untilReady(host);
  } catch (error) {
    child.kill('SIGKILL');
    throw error;
  }
  return host;
}

/** Stops a host: politely, then for good if it lingers. */
export function stopHostProcess(child: ChildProcess, graceMs = 5_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((done) => {
    const force = setTimeout(() => child.kill('SIGKILL'), graceMs);
    child.once('exit', () => {
      clearTimeout(force);
      done();
    });
    child.kill('SIGTERM');
  });
}
