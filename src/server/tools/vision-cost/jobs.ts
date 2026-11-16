/** The bench's call list: every format × size for the answer-key questions. Pure. */
import { SIZES, type ImageRef, type KeyEntry, type Manifest, type Sheet } from './bench-data.js';
import { LETTERS, type Expected, type Letter } from './reply.js';
import type { Format } from './stats.js';

export interface Job {
  format: Format;
  size: number;
  image: ImageRef;
  /** Item numbers as shown to the model, with the key's letter. */
  expected: Expected[];
}

function asLetter(value: string | null): Letter | null {
  const found = LETTERS.find((l) => l === value);
  return found ?? null;
}

function fullJobs(manifest: Manifest, key: readonly KeyEntry[]): Job[] {
  const pages = [...new Set(key.map((k) => k.page))];
  return pages.flatMap((page) => {
    const item = manifest.pages.find((p) => p.page === page);
    if (!item) return [];
    const expected = key
      .filter((k) => k.page === page)
      .map((k) => ({ item: k.question, letter: asLetter(k.letter) }));
    return [{ format: 'FULL' as const, size: SIZES[0], image: item.image, expected }];
  });
}

function cropJobs(manifest: Manifest, key: readonly KeyEntry[], sizes: readonly number[]): Job[] {
  return sizes.flatMap((size) =>
    key.flatMap((k) => {
      const crop = manifest.crops.find((c) => c.page === k.page && c.question === k.question);
      const image = crop?.sizes[String(size)];
      if (!image) return [];
      return [{ format: 'CROP' as const, size, image, expected: [{ item: 1, letter: asLetter(k.letter) }] }];
    }),
  );
}

function sheetJobs(sheets: readonly Sheet[], sizes: readonly number[]): Job[] {
  return sizes.flatMap((size) =>
    sheets.flatMap((sheet) => {
      const image = sheet.sizes[String(size)];
      if (!image) return [];
      const expected = sheet.panels.map((p, i) => ({ item: i + 1, letter: asLetter(p.letter) }));
      return [{ format: 'SHEET' as const, size, image, expected }];
    }),
  );
}

export function buildJobs(
  manifest: Manifest,
  key: readonly KeyEntry[],
  sheets: readonly Sheet[],
  sizes: readonly number[] = SIZES,
): Job[] {
  return [...fullJobs(manifest, key), ...cropJobs(manifest, key, sizes), ...sheetJobs(sheets, sizes)];
}
