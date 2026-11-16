/**
 * Step 1 of the vision-cost bench: render the chosen pages, find each question's region from the
 * text layer and write crops at every bench size plus the whole-page image.
 *
 *   node --import tsx src/server/tools/vision-cost/prepare.ts --pdf <file> --out <dir> \
 *     --pages 2,3,4 [--dpi 150]
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIZES, type CropItem, type ImageRef, type Manifest, type PageItem } from './bench-data.js';
import { findRegions, parseBboxPages, toPixels, type BboxPage } from './regions.js';
import { argValue, imaging, run, writeJson } from './shell.js';

function renderPage(pdf: string, out: string, page: number, dpi: number): string {
  const prefix = join(out, 'pages', `p${page}`);
  run('pdftoppm', ['-r', String(dpi), '-f', String(page), '-l', String(page), '-singlefile', '-png', pdf, prefix]);
  return `${prefix}.png`;
}

function variants(src: string, stem: string): Record<string, ImageRef> {
  const sizes: Record<string, ImageRef> = {};
  for (const long of SIZES) {
    const path = `${stem}-${long}.png`;
    sizes[String(long)] = { path, ...imaging({ kind: 'fit', src, out: path, long }) };
  }
  return sizes;
}

function cropPage(page: BboxPage, png: string, out: string, dpi: number): CropItem[] {
  return findRegions(page).map((region) => {
    const stem = join(out, 'crops', `p${page.page}-q${region.question}`);
    const box = [0, toPixels(region.top, dpi), toPixels(page.width, dpi), toPixels(region.bottom, dpi)];
    imaging({ kind: 'crop', src: png, box, out: `${stem}.png` });
    return { page: page.page, question: region.question, sizes: variants(`${stem}.png`, stem) };
  });
}

function main(argv: readonly string[]): void {
  const pdf = argValue(argv, 'pdf', '');
  const out = argValue(argv, 'out', '');
  const dpi = Number(argValue(argv, 'dpi', '150'));
  const wanted = new Set(argValue(argv, 'pages', '').split(',').map(Number));
  for (const dir of ['pages', 'crops', 'full']) mkdirSync(join(out, dir), { recursive: true });
  const bboxPath = join(out, 'bbox.html');
  run('pdftotext', ['-bbox-layout', pdf, bboxPath]);
  const pages: PageItem[] = [];
  const crops: CropItem[] = [];
  for (const page of parseBboxPages(readFileSync(bboxPath, 'utf8'))) {
    if (!wanted.has(page.page)) continue;
    const png = renderPage(pdf, out, page.page, dpi);
    const pageCrops = cropPage(page, png, out, dpi);
    crops.push(...pageCrops);
    const full = join(out, 'full', `p${page.page}.png`);
    const image = { path: full, ...imaging({ kind: 'fit', src: png, out: full, long: SIZES[0] }) };
    pages.push({ page: page.page, questions: pageCrops.map((c) => c.question), image });
  }
  const manifest: Manifest = { dpi, pages, crops };
  writeJson(join(out, 'manifest.json'), manifest);
  console.log(`pages ${pages.length}, crops ${crops.length}`);
}

main(process.argv.slice(2));
