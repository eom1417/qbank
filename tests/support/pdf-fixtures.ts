import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { runTool } from '../../src/server/capabilities/sources/adapters/run-tool.js';

/**
 * Builds test PDFs from the HTML in tests/fixtures/import with Chromium (no binary fixtures in
 * git): a text PDF, a "scanned" PDF with no text layer, a protected one and damaged bytes.
 */
export async function buildPdfFixtures() {
  const dir = mkdtempSync(join(tmpdir(), 'qbank-pdf-'));
  const browser: Browser = await chromium.launch();
  const page = await browser.newPage();
  const textPdf = async (name: string) => {
    await page.goto(`file://${resolve(`tests/fixtures/import/${name}.html`)}`);
    const out = join(dir, `${name}.pdf`);
    await page.pdf({ path: out, format: 'A4', preferCSSPageSize: true });
    return out;
  };
  const english = await textPdf('english');
  const arabic = await textPdf('arabic');
  // A scan: the first English page as an image only, so only OCR can read it.
  await page.goto(`file://${resolve('tests/fixtures/import/english.html')}`);
  await page.setViewportSize({ width: 794, height: 1123 });
  const shot = (await page.screenshot({ fullPage: false })).toString('base64');
  await page.setContent(`<img src="data:image/png;base64,${shot}" style="width:100%">`);
  const scanned = join(dir, 'scanned.pdf');
  await page.pdf({ path: scanned, format: 'A4', printBackground: true });
  await browser.close();
  const protectedPdf = join(dir, 'protected.pdf');
  await runTool('mutool', ['clean', '-E', 'aes-256', '-U', 'secret', english, protectedPdf]);
  const damaged = join(dir, 'damaged.pdf');
  writeFileSync(damaged, '%PDF-1.7\nthis is not really a pdf\n');
  const text = join(dir, 'notes.txt');
  writeFileSync(text, 'plain text, not a PDF');
  return {
    dir,
    english,
    arabic,
    scanned,
    protectedPdf,
    damaged,
    text,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

export type PdfFixtures = Awaited<ReturnType<typeof buildPdfFixtures>>;
