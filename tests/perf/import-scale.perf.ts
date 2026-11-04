import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { describe, expect, it } from 'vitest';
import { ownerWithBank } from '../support/client.js';
import { drawFigures } from '../support/figures.js';
import { runImports, uploadFile } from '../support/imports.js';
import { useTestApp } from '../support/test-app.js';

// A 1500-page book (the largest allowed) imports page by page with flat memory (M17.5).
const PAGES = Number(process.env['PERF_PAGES'] ?? 1500);
/** Per page, rules only (text layer, figures, tables), on this machine. */
const MS_PER_PAGE = 400;
/** Memory may grow by at most this much while the whole book is read. */
const MAX_GROWTH_MB = 600;

const app = useTestApp();

const TOPICS = ['potassium', 'sodium', 'calcium', 'glucose', 'troponin', 'creatinine'];

/** One page of five different questions, numbered on from the page before; a figure every 5th. */
function pageHtml(page: number, figure: string) {
  const questions = Array.from({ length: 5 }, (_, i) => {
    const n = page * 5 + i + 1;
    const topic = TOPICS[n % TOPICS.length];
    return `<div class="q"><p>${n}. Case ${n}: serum ${topic} is abnormal on day ${n % 30}. What is the next step?</p>
      <p>A. Repeat the test</p><p>B. Treat ${topic} now</p><p>C. Observe for ${n % 7} hours</p><p>D. Refer</p></div>`;
  });
  const picture = page % 5 === 0 ? `<img src="${figure}" style="width:60mm">` : '';
  return `<section style="break-after:page">${questions.join('')}${picture}</section>`;
}

/** A book of `PAGES` pages with different questions on each, printed by the test browser. */
async function bigBook() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const { ecg } = await drawFigures(page);
  const body = Array.from({ length: PAGES }, (_, p) => pageHtml(p, ecg ?? '')).join('');
  await page.setContent(
    `<!doctype html><html lang="en"><body style="font-family:'Liberation Serif',serif;font-size:11pt">${body}</body></html>`,
  );
  const book = join(mkdtempSync(join(tmpdir(), 'qbank-book-')), 'book.pdf');
  await page.pdf({
    path: book,
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '16mm', right: '16mm' },
  });
  await browser.close();
  return book;
}

describe(`importing a ${PAGES}-page book`, () => {
  it('reads every page within its budget, and memory stays flat', async () => {
    const book = await bigBook();
    console.log(`book: ${(readFileSync(book).length / 1024 / 1024).toFixed(1)} MB`);
    const { owner, bankId } = await ownerWithBank(app());
    const upload = await uploadFile(app(), owner.cookie(), bankId, book);
    expect(upload.statusCode).toBe(201);
    let peak = process.memoryUsage().rss;
    const sampler = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 500);
    const before = process.memoryUsage().rss;
    const started = performance.now();
    await runImports(app());
    const ms = performance.now() - started;
    clearInterval(sampler);
    const job = (await owner.get(`/api/imports/${upload.json().id}`)).json();
    const growth = (peak - before) / 1024 / 1024;
    console.log(
      `${PAGES} pages in ${(ms / 1000).toFixed(0)} s: ${(ms / PAGES).toFixed(0)} ms/page, ` +
        `${job.questionsFound} questions, memory +${growth.toFixed(0)} MB`,
    );
    console.log(
      JSON.stringify({ stage: job.stage, error: job.errorCode, pagesDone: job.pagesDone }),
    );
    expect(job.stage).not.toBe('failed');
    expect(job.questionsFound).toBeGreaterThan(PAGES * 4);
    expect(ms / PAGES).toBeLessThan(MS_PER_PAGE);
    expect(growth).toBeLessThan(MAX_GROWTH_MB);
  });
});
