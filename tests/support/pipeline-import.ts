import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { afterAll, beforeAll } from 'vitest';
import { ownerWithBank } from './client.js';
import { FAKE_INSTANCES, useFakeAiHost } from './fake-ai-host.js';
import { uploadFile } from './imports.js';
import { drawFigures } from './figures.js';
import { useTestApp, type TestAppOptions } from './test-app.js';

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

/** A clock the test moves: it reads `startAt` until set or advanced. */
export function testClock(startAt: Date) {
  let current = startAt;
  return {
    now: () => current,
    set: (at: Date) => void (current = at),
    advance: (ms: number) => void (current = new Date(current.getTime() + ms)),
  };
}

/**
 * The world a pipeline import test runs in: the fake AI host, the app pointed at it, the
 * synthetic file and the clock the app reads. `options` adds to the app's (AI required).
 */
export function usePipelineWorld(
  options: Omit<TestAppOptions, 'aiHost' | 'clock'> = {},
  startAt = new Date('2026-11-17T10:00:00Z'),
) {
  const clock = testClock(startAt);
  const fake = useFakeAiHost();
  const app = useTestApp({ aiHost: () => fake().settings, clock, ...options });
  const pipelineFile = usePipelineFile();
  /** A new owner and bank, AI consent given, the synthetic file uploaded for the pipeline. */
  const startImport = async (fields: Record<string, string> = {}) => {
    const { owner, bankId } = await ownerWithBank(app());
    await owner.post('/api/account/ai-consent', {});
    const started = await uploadFile(app(), owner.cookie(), bankId, pipelineFile(), {
      aiProviderId: FAKE_INSTANCES.lesson,
      ...fields,
    });
    return { owner, bankId, started };
  };
  return { fake, app, clock, db: () => app.db(), pipelineFile, startImport };
}
