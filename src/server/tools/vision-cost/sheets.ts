/**
 * Step 2: contact sheets of the answer-key questions, ≤10 numbered crops per sheet, at every
 * bench size. Writes sheets.json next to the manifest.
 *
 *   node --import tsx src/server/tools/vision-cost/sheets.ts --out <dir>
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SIZES, type CropItem, type KeyEntry, type Manifest, type Sheet } from './bench-data.js';
import { MAX_SHEET_ITEMS, layoutSheet } from './sheet-layout.js';
import { argValue, imaging, readJson, writeJson } from './shell.js';

/** Splits `items` into the fewest chunks of at most `max`, sizes as even as possible. */
export function evenChunks<T>(items: readonly T[], max: number): T[][] {
  const count = Math.ceil(items.length / max);
  const chunks: T[][] = [];
  let start = 0;
  for (let i = 0; i < count; i += 1) {
    const size = Math.ceil((items.length - start) / (count - i));
    chunks.push(items.slice(start, start + size));
    start += size;
  }
  return chunks;
}

function cropFor(manifest: Manifest, entry: KeyEntry): CropItem {
  const crop = manifest.crops.find((c) => c.page === entry.page && c.question === entry.question);
  if (!crop) throw new Error(`no crop for page ${entry.page} Q${entry.question}`);
  return crop;
}

function drawSheet(crops: readonly CropItem[], long: number, out: string): Sheet['sizes'][string] {
  const native = crops.map((c) => c.sizes[String(SIZES[0])]).filter((r) => r !== undefined);
  const cellWidth = Math.max(...native.map((r) => r.width));
  const layout = layoutSheet(native, long, cellWidth);
  const items = layout.placements.map((p) => ({
    src: native[p.index]?.path,
    x: p.x,
    y: p.y,
    w: p.width,
    h: p.height,
    labelY: p.labelY,
    label: String(p.index + 1),
  }));
  const size = imaging({ kind: 'sheet', out, width: layout.width, height: layout.height, items });
  return { path: out, ...size };
}

function main(argv: readonly string[]): void {
  const out = argValue(argv, 'out', '');
  const manifest = readJson<Manifest>(join(out, 'manifest.json'));
  const key = readJson<{ entries: KeyEntry[] }>(join(out, 'key.json')).entries;
  mkdirSync(join(out, 'sheets'), { recursive: true });
  const sheets: Sheet[] = evenChunks(key, MAX_SHEET_ITEMS).map((panels, i) => {
    const crops = panels.map((entry) => cropFor(manifest, entry));
    const sizes: Sheet['sizes'] = {};
    for (const long of SIZES) {
      sizes[String(long)] = drawSheet(crops, long, join(out, 'sheets', `s${i + 1}-${long}.png`));
    }
    return { id: `s${i + 1}`, panels, sizes };
  });
  writeJson(join(out, 'sheets.json'), sheets);
  console.log(sheets.map((s) => `${s.id}: ${s.panels.length} panels`).join(', '));
}

if (process.argv[1]?.endsWith('sheets.ts')) main(process.argv.slice(2));
