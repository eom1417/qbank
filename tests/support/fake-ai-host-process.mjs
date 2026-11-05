// A stand-in for ai-host/src/main.ts run as its own process (DEC-35 tests): it speaks the host's
// routes, says which folder it serves, and records each question in that folder. No provider.
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, join } from 'node:path';
import process from 'node:process';

const { AI_HOST_TOKEN: token, AI_HOST_PORT: port, AI_HOST_HOME: home } = process.env;
const account = basename(home ?? '');

const instance = {
  instanceId: 'own',
  driver: 'claudeAgent',
  enabled: true,
  installed: true,
  status: 'ready',
  supportsTextGeneration: true,
  auth: { status: 'authenticated', label: account },
  models: [{ slug: 'fake-large', name: 'Fake Large', isDefault: true }],
};

const drivers = [
  { driverKind: 'cursor', environmentFields: [{ name: 'CURSOR_API_KEY', sensitive: true }] },
  { driverKind: 'claudeAgent', environmentFields: [] },
];

/** What this host serves, and what it saw of its own process. */
const state = () => ({
  providers: [instance],
  served: { account, home: process.env.HOME, environment: Object.keys(process.env).sort() },
});

function reply(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

function route(request, response, body) {
  if (request.url === '/health') return reply(response, 200, { status: 'ok' });
  if (request.url === '/crash') return process.exit(1);
  if (request.url === '/state') return reply(response, 200, state());
  if (request.url === '/drivers') return reply(response, 200, { drivers });
  appendFileSync(join(home, 'requests.log'), `${request.method} ${request.url} ${body}\n`);
  if (request.url === '/ask') return reply(response, 200, { text: '{"ok": true}' });
  return reply(response, 200, { account });
}

const server = createServer((request, response) => {
  let body = '';
  request.on('data', (chunk) => (body += String(chunk)));
  request.on('end', () => {
    const allowed =
      request.headers.host === `127.0.0.1:${port}` &&
      request.headers.authorization === `Bearer ${token}`;
    if (!allowed) return reply(response, 401, { error: 'unauthorized' });
    return route(request, response, body);
  });
});
server.listen(Number(port), '127.0.0.1');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
// Like ai-host with AI_HOST_EXIT_WITH_PARENT: gone when the server that started it is.
if (process.env.AI_HOST_EXIT_WITH_PARENT === '1')
  process.stdin.on('end', () => process.exit(0)).resume();
