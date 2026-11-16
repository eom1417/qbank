import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Size } from './sheet-layout.js';

/** Runs a program (no shell) and returns stdout; throws with stderr on a non-zero exit. */
export function run(program: string, args: readonly string[], input?: string): string {
  const result = spawnSync(program, args, { input, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`${program} failed (${String(result.status)}): ${result.stderr}`);
  }
  return result.stdout;
}

const IMAGING = join(dirname(fileURLToPath(import.meta.url)), 'imaging.py');

/** Hands one job to imaging.py and returns the written image size. */
export function imaging(job: Record<string, unknown>): Size {
  const [width, height] = run('python3', ['-I', IMAGING], JSON.stringify(job)).trim().split(' ');
  return { width: Number(width), height: Number(height) };
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** `--name value` from argv, or the fallback. */
export function argValue(argv: readonly string[], name: string, fallback: string): string {
  const at = argv.indexOf(`--${name}`);
  const value = at >= 0 ? argv[at + 1] : undefined;
  return value ?? fallback;
}
