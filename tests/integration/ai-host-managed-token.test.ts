import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Codex runs ai-host as its token command in managed ChatGPT mode (the kit's self-invocation).
const NODE24 = process.env['QBANK_NODE24'] ?? '/opt/node24/bin/node';
const PROFILE = 'a'.repeat(64);
let dir = '';
const requests: unknown[] = [];

/** A stand-in for the kit's token broker: answers one frame, or hangs up on `silent`. */
function broker(path: string, reply: (request: { instanceId: string }) => string | null) {
  return new Promise<Server>((done) => {
    const server = createServer((socket) => {
      socket.once('data', (chunk) => {
        const request = JSON.parse(chunk.toString('utf8').trim()) as { instanceId: string };
        requests.push(request);
        const answer = reply(request);
        if (answer === null) socket.destroy();
        else socket.end(`${answer}\n`);
      });
    });
    server.listen(path, () => done(server));
  });
}

/** Runs the command as Codex does (async: the stand-in broker lives in this process). */
const run = (socket: string, instance: string) =>
  new Promise<{ status: number | null; stdout: string }>((done) => {
    const args = [resolve('ai-host/src/main.ts'), '__managed-chatgpt-token', socket, instance];
    execFile(NODE24, [...args, 'env-1', PROFILE], { timeout: 30_000 }, (error, stdout) =>
      done({ status: error ? (typeof error.code === 'number' ? error.code : null) : 0, stdout }),
    );
  });

let server: Server;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'qbank-broker-'));
  server = await broker(join(dir, 'broker.sock'), ({ instanceId }) =>
    instanceId === 'codex' ? JSON.stringify({ token: 'access-token-1' }) : null,
  );
});
afterAll(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('the managed ChatGPT token command', () => {
  it('prints only the access token the broker hands out', async () => {
    const result = await run(join(dir, 'broker.sock'), 'codex');
    expect([result.status, result.stdout]).toEqual([0, 'access-token-1']);
    expect(requests.at(-1)).toEqual({
      version: 1,
      instanceId: 'codex',
      environmentId: 'env-1',
      profileKey: PROFILE,
    });
  });

  it('fails without printing anything when the broker gives no token', async () => {
    const refused = await run(join(dir, 'broker.sock'), 'other');
    expect([refused.status, refused.stdout]).toEqual([1, '']);
    expect((await run(join(dir, 'missing.sock'), 'codex')).status).toBe(1);
  });
});
