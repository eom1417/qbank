// Proves that vendored third-party code is byte-identical to what was imported (Genesis rule:
// generated or third-party files are never hand-edited). Usage:
//   node scripts/vendor-lock.mjs --write   record vendor/<name>/ in vendor/<name>.lock.json
//   node scripts/vendor-lock.mjs --check   fail when any vendored file was added, removed or changed
//   node scripts/vendor-lock.mjs --restore rebuild vendor/<name>/ from its pinned archive, then check
// The archive vendor/<name>.tar.xz is the import itself; its SHA-256 is pinned in the lock, so the
// tree is reproduced from it byte for byte (Genesis' proof that generated files regenerate).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import console from 'node:console';
import process from 'node:process';

const ROOT = 'vendor';
// Installed packages and build output are not part of the import; they come from the lockfile.
const SKIP = new Set(['node_modules', '.DS_Store', 'dist']);

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return [];
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

function snapshot(name) {
  const base = join(ROOT, name);
  return Object.fromEntries(
    files(base)
      .map((path) => [relative(base, path).split('\\').join('/'), digest(path)])
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function differences(expected, actual) {
  const changed = [];
  for (const [path, hash] of Object.entries(expected)) {
    if (!(path in actual)) changed.push(`removed: ${path}`);
    else if (actual[path] !== hash) changed.push(`changed: ${path}`);
  }
  for (const path of Object.keys(actual)) if (!(path in expected)) changed.push(`added: ${path}`);
  return changed;
}

/** Extracts a package from its archive after checking the archive against the pinned digest. */
function restore(name, lock) {
  const archive = join(ROOT, `${name}.tar.xz`);
  if (!existsSync(archive) || digest(archive) !== lock.archive) {
    console.log(`FAIL: ${name}: its archive is missing or differs from the pinned SHA-256`);
    return false;
  }
  execFileSync('tar', ['-xJf', archive, '-C', ROOT]);
  return true;
}

const mode = process.argv[2];
const packages =
  mode === '--write'
    ? readdirSync(ROOT).filter((name) => statSync(join(ROOT, name)).isDirectory())
    : readdirSync(ROOT)
        .filter((name) => name.endsWith('.lock.json'))
        .map((name) => name.slice(0, -'.lock.json'.length));
let failed = false;
for (const name of packages) {
  const lockPath = join(ROOT, `${name}.lock.json`);
  if (mode === '--write') {
    const archive = join(ROOT, `${name}.tar.xz`);
    const pinned = existsSync(archive) ? { archive: digest(archive) } : {};
    writeFileSync(lockPath, `${JSON.stringify({ ...pinned, files: snapshot(name) }, null, 1)}\n`);
    console.log(`${name}: ${Object.keys(snapshot(name)).length} files recorded`);
    continue;
  }
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  if (mode === '--restore' && !restore(name, lock)) {
    failed = true;
    continue;
  }
  const changed = differences(lock.files, snapshot(name));
  if (changed.length > 0) failed = true;
  console.log(
    changed.length === 0
      ? `PASS: ${name} matches its lock`
      : `FAIL: ${name}\n${changed.join('\n')}`,
  );
}
if (!['--write', '--check', '--restore'].includes(mode)) {
  console.error('usage: node scripts/vendor-lock.mjs --write | --check | --restore');
  process.exit(2);
}
process.exit(failed ? 1 : 0);
