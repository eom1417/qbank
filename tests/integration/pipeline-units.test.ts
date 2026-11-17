import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildUnits,
  type FileUnits,
} from '../../src/server/capabilities/sources/adapters/pipeline-units.js';
import type { Unit } from '../../src/server/capabilities/sources/domain/pipeline/units.js';
import { buildPipelineFixtures } from '../support/pipeline-fixtures.js';

let fixtures: Awaited<ReturnType<typeof buildPipelineFixtures>>;
let typed: FileUnits;
let scanned: FileUnits;

beforeAll(async () => {
  // Parallel Tesseract runs with OpenMP threads crawl on a loaded machine (see units-report).
  process.env['OMP_THREAD_LIMIT'] ??= '1';
  fixtures = await buildPipelineFixtures();
  typed = await buildUnits(fixtures.units);
  scanned = await buildUnits(fixtures.scanned);
}, 240_000);

afterAll(() => fixtures.cleanup());

const unitsOf = (file: FileUnits, page: number): Unit[] =>
  file.pages.find((p) => p.size.page === page)?.units ?? [];
const labels = (units: readonly Unit[]) =>
  units
    .filter((unit) => unit.kind !== 'text_line')
    .map((unit) => (unit.kind === 'image' ? unit.imageClass : `filler:${unit.filler}`));

/** Every image and filler unit of the synthetic file, page by page, in reading order. */
const EXPECTED: Record<number, string[]> = {
  1: [
    'handwriting', // red hand circle around an option letter
    'handwriting', // red ✗ beside an option
    'handwriting', // yellow highlight over an option
    'filler:frame',
    'filler:repeated', // the logo on every page
    'filler:decor', // a thin bar under the header
    'filler:running_line',
  ],
  2: [
    'text_picture', // screenshot of typed text
    'handwriting', // red handwritten note
    'table',
    'figure', // X-ray-like film
    'filler:frame',
    'filler:repeated',
    'filler:running_line',
  ],
  3: [
    'figure', // photo (right, read first on an Arabic page)
    'figure', // ECG strip (left)
    'text_picture', // screenshot of typed Arabic
    'handwriting', // blue handwritten note
    'filler:watermark',
    'filler:repeated',
    'filler:running_line',
  ],
  4: ['figure', 'filler:repeated', 'filler:running_line'],
};

describe('units of a synthetic PDF (M34 P2)', () => {
  it('finds every image class and filler kind, page by page', () => {
    for (const [page, expected] of Object.entries(EXPECTED))
      expect(labels(unitsOf(typed, Number(page))), `page ${page}`).toEqual(expected);
  });

  it('keeps OCR text, its statistics and a fingerprint on every image', () => {
    const images = typed.pages.flatMap((page) => page.units).filter((u) => u.kind === 'image');
    expect(images.every((u) => u.ocr !== null && u.fingerprint?.length === 64)).toBe(true);
    const [english, arabic] = images.filter((u) => u.imageClass === 'text_picture');
    expect(english?.text).toContain('made-up patient');
    expect(english?.ocr?.confidence).toBeGreaterThan(80);
    expect(arabic?.text).toContain('العلاج');
  });

  it('reads typed lines in column order, with the picture in its place', () => {
    const texts = unitsOf(typed, 4).map((unit) => unit.text ?? '');
    const at = (start: string) => texts.findIndex((text) => text.startsWith(start));
    expect(at('Q7)')).toBe(0);
    expect(at('Q13)')).toBeLessThan(at('Q10)'));
    const picture = unitsOf(typed, 4).findIndex((unit) => unit.kind === 'image');
    expect(picture).toBe(at('B. Fast') + 1);
    expect(at('Q11)')).toBe(picture + 1);
  });

  it('reads the Arabic page right to left and keeps its question lines', () => {
    const units = unitsOf(typed, 3);
    const [photo, ecg] = units.filter((unit) => unit.kind === 'image');
    expect(photo?.box.x0).toBeGreaterThan(ecg?.box.x0 ?? Infinity);
    expect(units[0]?.text).toMatch(/^س5\)/);
  });

  it('calls the file annotated notes', () => {
    expect(typed.family.family).toBe('annotated_notes');
    expect(typed.family.lessons).toContain('D4.3');
  });

  it('reads a scanned page by OCR, its picture as filler', () => {
    const units = scanned.pages[0]?.units ?? [];
    const lines = units.filter((unit) => unit.kind === 'text_line');
    expect(scanned.pages[0]?.scanned).toBe(true);
    expect(lines.length).toBeGreaterThan(20);
    expect(lines.every((unit) => unit.source === 'ocr')).toBe(true);
    expect(labels(units)).toEqual(['filler:scan_page']);
    expect(scanned.family.family).toBe('scan');
  });
});
