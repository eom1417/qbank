// QBank on your own server for family and friends (accounts mode, DEC-35): run by
// compose.server.yaml inside the Docker image. Updates the database, then starts the API with the
// built web app; each account gets its own AI host, started on demand.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const DATA_DIR = resolve(ROOT, process.env.QBANK_DATA_DIR ?? '.data/app');
const env = {
  ...process.env,
  QBANK_MODE: 'accounts',
  QBANK_DATA_DIR: DATA_DIR,
  QBANK_AI_HOSTS: 'per_account',
  QBANK_AI_HOST_NODE: process.execPath,
  QBANK_AI_HOST_ENTRY: join(ROOT, 'ai-host/src/main.ts'),
  QBANK_WEB_DIR: join(ROOT, 'dist/web'),
  QBANK_SAMPLE_PDF: join(ROOT, 'samples/sample-bank.pdf'),
  QBANK_VERSION: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version,
};

const migrated = spawnSync(process.execPath, [join(ROOT, 'dist/src/server/migrate.js')], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});
if (migrated.status !== 0) process.exit(migrated.status ?? 1);

const server = spawn(process.execPath, [join(ROOT, 'dist/src/server/main.js')], {
  cwd: ROOT,
  env,
  stdio: 'inherit',
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.kill(signal));
server.on('exit', (code) => process.exit(code ?? 0));
