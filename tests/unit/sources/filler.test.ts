import { describe, expect, it } from 'vitest';
import {
  fingerprint,
  isDecor,
  pageSizedFiller,
  placeImages,
  printDistance,
  repeatedImages,
} from '../../../src/server/capabilities/sources/domain/pipeline/filler.js';
import type { ImageStats } from '../../../src/server/capabilities/sources/domain/pipeline/image-class.js';
import { paint } from '../../support/pipeline-fixtures.js';

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const disc = (size: number) =>
  paint(size, size, (x, y) =>
    Math.hypot(x - size / 2, y - size / 2) < size / 3 ? [30, 60, 140] : [255, 255, 255],
  );
const stripes = paint(64, 64, (x) => (x % 16 < 8 ? [0, 0, 0] : [255, 255, 255]));

describe('filler (M34 D1.3)', () => {
  it('fingerprints the content, not the resolution', () => {
    expect(fingerprint(disc(64))).toMatch(/^[0-9a-f]{64}$/);
    expect(printDistance(fingerprint(disc(64)), fingerprint(disc(96)))).toBeLessThanOrEqual(8);
    expect(printDistance(fingerprint(disc(64)), fingerprint(stripes))).toBeGreaterThan(8);
  });

  it('marks an image repeated at one place on enough pages, and nothing on two pages', () => {
    const logo = (page: number, x = 30) => ({ page, box: box(x, 20, x + 40, 60), print: 'f0' });
    const four = [logo(1), logo(2), logo(3), logo(4), logo(5, 300)];
    const repeated = repeatedImages(four, 10);
    expect([...repeated].map((image) => image.page)).toEqual([1, 2, 3, 4]);
    expect(repeatedImages([logo(1), logo(2)], 2).size).toBe(0);
    expect(repeatedImages(four, 20).size).toBe(0);
  });
});

describe('decor and page-sized filler (M34 D1.3)', () => {
  it('calls specks and thin bars decor, not marks', () => {
    expect(isDecor(box(0, 0, 3, 3))).toBe(true);
    expect(isDecor(box(0, 0, 300, 4))).toBe(true);
    expect(isDecor(box(0, 0, 20, 20))).toBe(false);
  });

  it('tells a scan page, a frame and a watermark from a full-page screenshot', () => {
    const stats = (over: Partial<ImageStats>): ImageStats => ({
      paperShare: 0.9,
      darkShare: 0.05,
      penShare: 0,
      markerShare: 0,
      toneLevels: 2,
      rows: [],
      columns: [],
      ...over,
    });
    const typed = { scanned: false, wordsOver: false, wholePage: true };
    expect(pageSizedFiller(stats({}), { ...typed, scanned: true })).toBe('scan_page');
    expect(pageSizedFiller(stats({ rows: [0.02, 0.98], columns: [0.03, 0.97] }), typed)).toBe(
      'frame',
    );
    expect(pageSizedFiller(stats({ darkShare: 0.001 }), typed)).toBe('watermark');
    expect(pageSizedFiller(stats({}), { ...typed, wordsOver: true })).toBe('scan_page');
    const framedShot = stats({ rows: [0.02, 0.98], columns: [0.03, 0.97] });
    expect(pageSizedFiller(framedShot, { ...typed, wholePage: false })).toBeNull();
    expect(pageSizedFiller(stats({}), typed)).toBeNull();
  });
});

describe('image placement (M34 D1.3)', () => {
  it('places figures, overlay tiles, decor and page-sized images', () => {
    const page = { page: 1, width: 600, height: 800, words: [] };
    const image = (b: ReturnType<typeof box>, pixels = 300) => ({
      box: b,
      pixelWidth: pixels,
      pixelHeight: pixels,
    });
    const figure = image(box(40, 40, 240, 200));
    const tiles = [image(box(0, 300, 200, 500), 512), image(box(200, 300, 400, 500), 512)];
    const edgeTile = image(box(400, 300, 420, 500), 512);
    const bar = image(box(40, 20, 400, 23));
    const whole = image(box(0, 0, 600, 800), 1200);
    const mark = image(box(100, 600, 120, 620), 40);
    const placed = placeImages(page, [figure, ...tiles, edgeTile, bar, whole, mark]);
    expect([...placed.values()]).toEqual([
      'content',
      'ink_overlay',
      'ink_overlay',
      'ink_overlay',
      'decor',
      'page_sized',
      'content',
    ]);
  });
});
