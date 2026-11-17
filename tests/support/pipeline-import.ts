import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, beforeAll } from 'vitest';
import { drawFigures } from './figures.js';

// M34 P5: the synthetic file a pipeline import reads (tests/fixtures/import/pipeline-import.html):
// a case shared by two questions, a tag line and a printed key, an explanation picture, a film
// the stem points to, and an unanswered question. No owner file content.

async function printFixture(dir: string): Promise<string> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const figures = await drawFigures(page);
  const html = readFileSync(resolve('tests/fixtures/import/pipeline-import.html'), 'utf8');
  await page.setContent(html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => figures[key] ?? ''));
  const file = join(dir, 'pipeline-import.pdf');
  await page.pdf({ path: file, format: 'A4', preferCSSPageSize: true });
  await browser.close();
  return file;
}

/** Prints the fixture once for the suite file; call the getter inside tests. */
export function usePipelineFile(): () => string {
  let dir = '';
  let file = '';
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'qbank-pipeline-import-'));
    file = await printFixture(dir);
  }, 120_000);
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  return () => file;
}
