// QBank on your own computer, in one command (DEC-31): `npm run qbank [-- --lan] [-- --no-open]`.
// Builds once if needed, starts the AI host (the providers kit, Node >= 24.10) and the API with
// the built web app, waits until both answer, then opens the browser. Ctrl+C stops both.
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

const { fetch } = globalThis;

const ROOT = resolve(import.meta.dirname, '..');
const DATA_DIR = resolve(ROOT, process.env.QBANK_DATA_DIR ?? '.data/app');
const API_PORT = process.env.QBANK_API_PORT ?? '3000';
const AI_HOST_PORT = process.env.QBANK_AI_HOST_PORT ?? '3790';
const lan = process.argv.includes('--lan');
const openBrowser = !process.argv.includes('--no-open');

/** The providers kit needs Node >= 24.10 (scripts/setup-ai-host.sh installs it in /opt/node24). */
function node24() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major > 24 || (major === 24 && minor >= 10)) return process.execPath;
  const candidates = [process.env.QBANK_NODE24, '/opt/node24/bin/node'].filter(Boolean);
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('Node 24.10+ is needed for AI: run bash scripts/setup-ai-host.sh');
  return found;
}

function buildIfNeeded() {
  if (
    existsSync(join(ROOT, 'dist/web/index.html')) &&
    existsSync(join(ROOT, 'dist/src/server/main.js'))
  )
    return;
  console.log('Building QBank once…');
  const result = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('The build failed');
}

const children = [];

function start(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    if (stopping) return;
    console.error(`${name} stopped (${code}); stopping QBank.`);
    stop(1);
  });
  children.push(child);
}

let stopping = false;
function stop(code = 0) {
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

async function waitFor(url, headers = {}) {
  for (let attempt = 0; attempt < 240; attempt++) {
    try {
      if ((await fetch(url, { headers })).ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(250);
  }
  throw new Error(`${url} did not start`);
}

/** The first private IPv4 address of this computer, for phones on the same Wi-Fi. */
function lanAddress() {
  const addresses = Object.values(networkInterfaces()).flat();
  return addresses.find((a) => a && a.family === 'IPv4' && !a.internal)?.address ?? null;
}

function openInBrowser(url) {
  const opener = { darwin: 'open', win32: 'explorer' }[process.platform] ?? 'xdg-open';
  spawn(opener, [url], { stdio: 'ignore', detached: true })
    .on('error', () => undefined)
    .unref();
}

function announce() {
  const local = `http://127.0.0.1:${API_PORT}`;
  console.log(`\nQBank is ready: ${local}`);
  const address = lan ? lanAddress() : null;
  if (address) {
    const code = readFileSync(join(DATA_DIR, 'pairing-token'), 'utf8').trim();
    console.log(`On your phone (same Wi-Fi): http://${address}:${API_PORT}/#pair=${code}`);
    console.log('Anyone with that link can open your QBank: keep it to your own devices.');
  }
  // In Docker (M25) this computer is recognised through Docker's network; if a setup is ever
  // not, the owner still gets in with the link below, printed only to their own terminal.
  if (process.env.QBANK_SHOW_PAIRING_LINK === '1') {
    const code = readFileSync(join(DATA_DIR, 'pairing-token'), 'utf8').trim();
    console.log(`If QBank asks this computer for a code, open: ${local}/#pair=${code}`);
  }
  if (openBrowser) openInBrowser(local);
}

async function main() {
  buildIfNeeded();
  mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  const token = randomBytes(32).toString('hex');
  start('AI host', node24(), [join(ROOT, 'ai-host/src/main.ts')], {
    AI_HOST_TOKEN: token,
    AI_HOST_PORT,
    AI_HOST_AUTO_UPDATE: '1',
    AI_HOST_HOME: join(DATA_DIR, 'ai-host'),
  });
  start('QBank', process.execPath, [join(ROOT, 'dist/src/server/main.js')], {
    QBANK_MODE: 'local',
    QBANK_DATA_DIR: DATA_DIR,
    // Docker sets 0.0.0.0 (inside the container); compose.yaml publishes it to loopback only.
    QBANK_API_HOST: process.env.QBANK_API_HOST ?? (lan ? '0.0.0.0' : '127.0.0.1'),
    QBANK_API_PORT: API_PORT,
    QBANK_AI_HOST_URL: `http://127.0.0.1:${AI_HOST_PORT}`,
    QBANK_AI_HOST_TOKEN: token,
    QBANK_WEB_DIR: join(ROOT, 'dist/web'),
    QBANK_SAMPLE_PDF: join(ROOT, 'samples/sample-bank.pdf'),
    QBANK_VERSION: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version,
  });
  await waitFor(`http://127.0.0.1:${AI_HOST_PORT}/health`, { authorization: `Bearer ${token}` });
  await waitFor(`http://127.0.0.1:${API_PORT}/api/health`);
  announce();
}

process.once('SIGINT', () => stop(0));
process.once('SIGTERM', () => stop(0));
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
});
