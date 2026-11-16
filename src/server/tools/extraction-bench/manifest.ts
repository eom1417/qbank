import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { run } from '../vision-cost/shell.js';

// M34 P0 step 1: `node --import tsx src/server/tools/extraction-bench/manifest.ts [corpusDir]`
// Writes `<corpusDir>/MANIFEST.json`: each file's fingerprint, pages and images. An image object
// placed many times (a frame, a logo) counts once in `uniqueImages` (K5). The hidden set is never
// opened here; its fingerprints stay in `.data/holdout/MANIFEST.sha256`.

export interface ImageRow {
  page: number;
  width: number;
  height: number;
  object: string;
}

/** Parses `pdfimages -list` (page num type width height … object ID …); masks are skipped. */
export function parseImageList(listing: string): ImageRow[] {
  return listing
    .split('\n')
    .slice(2)
    .map((line) => line.trim().split(/\s+/))
    .filter((cells) => cells.length >= 12 && cells[2] === 'image')
    .map((cells) => ({
      page: Number(cells[0]),
      width: Number(cells[3]),
      height: Number(cells[4]),
      object: cells[10] ?? '',
    }));
}

export function summarise(rows: readonly ImageRow[]) {
  const uses = new Map<string, number>();
  for (const row of rows) uses.set(row.object, (uses.get(row.object) ?? 0) + 1);
  return {
    placedImages: rows.length,
    uniqueImages: uses.size,
    repeatedObjects: [...uses.values()].filter((count) => count > 1).length,
    pagesWithImages: new Set(rows.map((row) => row.page)).size,
  };
}

function pageCount(file: string): number {
  const info = run('pdfinfo', [file]);
  return Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] ?? 0);
}

function textPages(file: string, pages: number): number {
  const text = run('pdftotext', ['-layout', file, '-']);
  const withText = text.split('\f').filter((page) => page.replace(/\s/g, '').length > 40);
  return Math.min(withText.length, pages);
}

function describe(dir: string, name: string) {
  const file = join(dir, name);
  const pages = pageCount(file);
  const listing = run('pdfimages', ['-list', file]);
  return {
    file: name,
    sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
    pages,
    pagesWithText: textPages(file, pages),
    ...summarise(parseImageList(listing)),
  };
}

if (process.argv[1]?.endsWith('manifest.ts')) {
  const dir = process.argv[2] ?? '.data/corpus';
  const files = readdirSync(dir).filter((name) => name.endsWith('.pdf')).sort();
  const entries = files.map((name) => describe(dir, name));
  writeFileSync(join(dir, 'MANIFEST.json'), JSON.stringify(entries, null, 2));
  console.log(`${entries.length} files, ${entries.reduce((n, e) => n + e.pages, 0)} pages`);
}
