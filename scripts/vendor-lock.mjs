// Proves that vendored third-party code is byte-identical to what was imported (Genesis rule:
// generated or third-party files are never hand-edited). Usage:
//   node scripts/vendor-lock.mjs --write   record vendor/<name>/ in vendor/<name>.lock.json
//   node scripts/vendor-lock.mjs --check   fail when any vendored file was added, removed or changed
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

const packages = readdirSync(ROOT).filter((name) => statSync(join(ROOT, name)).isDirectory());
const mode = process.argv[2];
let failed = false;
for (const name of packages) {
  const lockPath = join(ROOT, `${name}.lock.json`);
  const actual = snapshot(name);
  if (mode === '--write') {
    writeFileSync(lockPath, `${JSON.stringify({ files: actual }, null, 1)}\n`);
    console.log(`${name}: ${Object.keys(actual).length} files recorded`);
    continue;
  }
  const changed = differences(JSON.parse(readFileSync(lockPath, 'utf8')).files, actual);
  if (changed.length > 0) failed = true;
  console.log(
    changed.length === 0
      ? `PASS: ${name} matches its lock`
      : `FAIL: ${name}\n${changed.join('\n')}`,
  );
}
if (mode !== '--write' && mode !== '--check') {
  console.error('usage: node scripts/vendor-lock.mjs --write | --check');
  process.exit(2);
}
process.exit(failed ? 1 : 0);
