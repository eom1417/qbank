import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { runTool } from '../../src/server/capabilities/sources/adapters/run-tool.js';
import { drawFigures } from './figures.js';

/** Files an import must refuse: protected, damaged, and not a PDF at all. */
async function refusedFiles(dir: string, readable: string) {
  const protectedPdf = join(dir, 'protected.pdf');
  await runTool('mutool', ['clean', '-E', 'aes-256', '-U', 'secret', readable, protectedPdf]);
  const damaged = join(dir, 'damaged.pdf');
  writeFileSync(damaged, '%PDF-1.7\nthis is not really a pdf\n');
  const text = join(dir, 'notes.txt');
  writeFileSync(text, 'plain text, not a PDF');
  return { protectedPdf, damaged, text };
}

/**
 * Builds test PDFs from the HTML in tests/fixtures/import with Chromium (no binary fixtures in
 * git): text PDFs, "scanned" PDFs with no text layer, a protected one and damaged bytes.
 */
export async function buildPdfFixtures() {
  const dir = mkdtempSync(join(tmpdir(), 'qbank-pdf-'));
  const browser: Browser = await chromium.launch();
  const page = await browser.newPage();
  const textPdf = async (name: string, images: Record<string, string> = {}) => {
    const html = readFileSync(resolve(`tests/fixtures/import/${name}.html`), 'utf8');
    await page.setContent(html.replace(/\{\{(\w+)\}\}/g, (_, key: string) => images[key] ?? ''));
    const out = join(dir, `${name}.pdf`);
    await page.pdf({ path: out, format: 'A4', preferCSSPageSize: true });
    return out;
  };
  const scanOf = async (name: string) => {
    // A scan: the first page as an image only, so only OCR can read it.
    await textPdf(name, images);
    await page.setViewportSize({ width: 794, height: 1123 });
    const shot = (await page.screenshot({ fullPage: false })).toString('base64');
    await page.setContent(`<img src="data:image/png;base64,${shot}" style="width:100%">`);
    const out = join(dir, `${name}-scanned.pdf`);
    await page.pdf({ path: out, format: 'A4', printBackground: true });
    return out;
  };
  const images = await drawFigures(page);
  const media = await textPdf('media', images);
  const mediaScanned = await scanOf('media');
  const english = await textPdf('english');
  const arabic = await textPdf('arabic');
  const mixed = await textPdf('mixed');
  const essays = await textPdf('essays');
  const keys = await textPdf('keys');
  const answersOnly = await textPdf('answers-only');
  const scanned = await scanOf('english');
  const arabicScanned = await scanOf('arabic');
  await browser.close();
  const refused = await refusedFiles(dir, english);
  return {
    dir,
    english,
    arabic,
    mixed,
    essays,
    keys,
    answersOnly,
    scanned,
    arabicScanned,
    media,
    mediaScanned,
    ...refused,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export type PdfFixtures = Awaited<ReturnType<typeof buildPdfFixtures>>;
