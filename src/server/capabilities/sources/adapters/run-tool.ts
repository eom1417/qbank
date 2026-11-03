import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** Runs a local command-line tool (poppler, MuPDF, Tesseract) with a time limit; no shell. */
export async function runTool(command: string, args: readonly string[], timeoutMs = 120_000) {
  const { stdout } = await run(command, [...args], {
    timeout: timeoutMs,
    maxBuffer: 256 * 1024 * 1024,
    encoding: 'buffer',
  });
  return stdout;
}

/** A private temporary folder for one tool run, always removed afterwards. */
export async function withTempDir<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'qbank-read-'));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Renders one page to a grayscale PGM file with poppler and returns its path. */
export async function renderPgm(file: string, page: number, dpi: number, dir: string) {
  const root = join(dir, 'page');
  const args = ['-gray', '-singlefile', '-r', String(dpi), '-f', String(page), '-l', String(page)];
  await runTool('pdftoppm', [...args, file, root]);
  return `${root}.pgm`;
}

export const readBytes = (path: string) => readFile(path);
