// The installer's steps (M16.5), started by scripts/install.sh once Node 24.10+ is there.
// Safe to run again: each step checks first and adds only what is missing.
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import console from 'node:console';
import process from 'node:process';

const ROOT = resolve(import.meta.dirname, '..');
const LAUNCHER = join(homedir(), '.local', 'bin', 'qbank');
const check = process.argv.includes('--check');
const withAiClis = process.argv.includes('--with-ai-clis');

const has = (command) => spawnSync('sh', ['-c', `command -v ${command}`]).status === 0;

/** Runs a step's command in the project, stopping the install when it fails. */
function run(command, args, cwd = ROOT, env = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`);
}

const asRoot = (args) => (process.getuid?.() === 0 ? args : ['sudo', ...args]);

/** Poppler renders pages, MuPDF reads text with fonts, Tesseract reads scans (Arabic, English). */
const READING_TOOLS = {
  brew: ['brew', 'install', 'poppler', 'mupdf-tools', 'tesseract', 'tesseract-lang'],
  apt: asRoot([
    'apt-get',
    'install',
    '-y',
    'poppler-utils',
    'mupdf-tools',
    'tesseract-ocr',
    'tesseract-ocr-ara',
    'tesseract-ocr-eng',
  ]),
  dnf: asRoot([
    'dnf',
    'install',
    '-y',
    'poppler-utils',
    'mupdf',
    'tesseract',
    'tesseract-langpack-ara',
    'tesseract-langpack-eng',
  ]),
};

const readingToolsOk = () => ['pdftoppm', 'mutool', 'tesseract'].every(has);

const splitFirst = ([command, ...args]) => [command, args];

function installReadingTools() {
  if (readingToolsOk()) return;
  const manager = ['brew', 'apt', 'dnf'].find((name) => has(name === 'apt' ? 'apt-get' : name));
  if (!manager)
    throw new Error('Install poppler, MuPDF (mutool) and Tesseract (ara + eng), then run again.');
  // A fresh machine's package lists can be old enough that install finds nothing: refresh first.
  if (manager === 'apt') run(...splitFirst(asRoot(['apt-get', 'update'])));
  run(...splitFirst(READING_TOOLS[manager]));
}

/** The vendored providers kit, checked against its lock, with its own exact dependencies. */
function installAiHost() {
  run('node', ['scripts/vendor-lock.mjs', '--check']);
  const kit = join(ROOT, 'vendor/t3-ai-providers-kit/kit');
  // Node 25+ no longer ships corepack (Homebrew's node is 26): pnpm 10 through npx there.
  const pnpm = has('corepack') ? ['corepack', ['pnpm@10']] : ['npx', ['--yes', 'pnpm@10']];
  run(pnpm[0], [...pnpm[1], 'install', '--frozen-lockfile'], kit, {
    CI: 'true',
    COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
  });
  run('ln', [
    '-sfn',
    '../vendor/t3-ai-providers-kit/kit/apps/server/node_modules',
    'ai-host/node_modules',
  ]);
}

/** `qbank` from any terminal: starts QBank and opens it (`qbank --lan` for a phone). */
function installLauncher() {
  mkdirSync(join(homedir(), '.local', 'bin'), { recursive: true });
  writeFileSync(
    LAUNCHER,
    `#!/usr/bin/env bash\ncd '${ROOT.replace(/'/g, `'\\''`)}' && exec npm run qbank -- "$@"\n`,
  );
  chmodSync(LAUNCHER, 0o755);
}

const PARTS = [
  ['poppler, MuPDF, Tesseract', readingToolsOk],
  ['npm packages', () => existsSync(join(ROOT, 'node_modules'))],
  ['AI host packages', () => existsSync(join(ROOT, 'ai-host/node_modules'))],
  ['the built app', () => existsSync(join(ROOT, 'dist/web/index.html'))],
  ['the qbank command', () => existsSync(LAUNCHER)],
];

function report() {
  const missing = PARTS.filter(([, ok]) => !ok()).map(([name]) => name);
  console.log(missing.length === 0 ? 'Everything is installed.' : `Missing: ${missing.join(', ')}`);
}

function install() {
  const steps = [
    ['Reading tools', installReadingTools],
    ['QBank', () => run('npm', ['ci', '--no-audit', '--no-fund'])],
    ['AI host', installAiHost],
    [
      'AI CLIs',
      () =>
        withAiClis && run('npm', ['install', '-g', '@openai/codex', '@anthropic-ai/claude-code']),
    ],
    ['Build', () => run('npm', ['run', 'build'])],
    ['Launcher', installLauncher],
  ];
  for (const [name, step] of steps) {
    console.log(`\n== ${name}`);
    step();
  }
  console.log('\nDone. Start QBank: qbank   (for your phone on the same Wi-Fi: qbank --lan)');
  if (!(process.env.PATH ?? '').split(':').includes(join(homedir(), '.local', 'bin')))
    console.log(`Add ~/.local/bin to your PATH, or run: ${LAUNCHER}`);
  console.log(`Your data stays in ${join(ROOT, '.data/app')}. Back it up from Settings → Backups.`);
}

try {
  if (check) report();
  else install();
} catch (error) {
  console.error(`\nThe install stopped: ${error.message}`);
  process.exit(1);
}
