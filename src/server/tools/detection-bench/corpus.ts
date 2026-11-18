import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

// M39 bench: prints each hard-case page of tests/fixtures/detection to a PDF, cached by the
// html's hash so an unchanged page is printed once.

export const CORPUS_DIR = resolve('tests/fixtures/detection');
const PDF_DIR = join(tmpdir(), 'qbank-detection-corpus');

export const corpusNames = (): string[] =>
  readdirSync(CORPUS_DIR)
    .filter((entry) => entry.endsWith('.html'))
    .map((entry) => entry.replace(/\.html$/, ''));

/** The PDF of every corpus page (by name), printing only those whose html changed. */
export async function printCorpus(names: string[]): Promise<Map<string, string>> {
  mkdirSync(PDF_DIR, { recursive: true });
  const files = new Map<string, string>();
  const browser = await chromium.launch();
  try {
    for (const name of names) {
      const html = readFileSync(join(CORPUS_DIR, `${name}.html`), 'utf8');
      const hash = createHash('sha256').update(html).digest('hex').slice(0, 16);
      const path = join(PDF_DIR, `${name}-${hash}.pdf`);
      if (!existsSync(path)) {
        const page = await browser.newPage();
        await page.setContent(html);
        await page.pdf({ path, format: 'A4', preferCSSPageSize: true });
        await page.close();
      }
      files.set(name, path);
    }
  } finally {
    await browser.close();
  }
  return files;
}
