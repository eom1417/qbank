import { describe, expect, it } from 'vitest';
import {
  classifyImage,
  measureImage,
  type OcrStats,
} from '../../../src/server/capabilities/sources/domain/pipeline/image-class.js';
import { paint } from '../../support/pipeline-fixtures.js';

const WHITE = [255, 255, 255] as const;
const BLACK = [20, 20, 20] as const;
const RED = [210, 30, 30] as const;
const YELLOW = [255, 240, 120] as const;
const noWords: OcrStats = { words: 0, confidence: 0, textAreaRatio: 0 };
const typed: OcrStats = { words: 24, confidence: 92, textAreaRatio: 0.3 };

/** Black text-like bars on white. */
const printedText = paint(200, 100, (x, y) => (y % 20 < 6 && x % 12 < 9 ? BLACK : WHITE));
/** A thin red ring on white. */
const redRing = paint(100, 80, (x, y) => {
  const r = Math.hypot((x - 50) / 40, (y - 40) / 30);
  return r > 0.88 && r < 1 ? RED : WHITE;
});
const highlight = paint(150, 30, (x, y) => (y > 10 && y < 18 && x % 9 < 6 ? BLACK : YELLOW));
const ruled = paint(300, 160, (x, y) => (y % 50 < 2 || x % 100 < 2 ? BLACK : WHITE));
/** A dark film with a glow: wide tones, no paper. */
const film = paint(120, 120, (x, y) => {
  const level = Math.max(10, 230 - Math.hypot(x - 60, y - 60) * 3);
  return [level, level, level];
});

describe('image class by code (M34 D1.2)', () => {
  it('reads printed words in a picture as a text picture', () => {
    expect(classifyImage(typed, measureImage(printedText))).toBe('text_picture');
  });

  it('reads red pen and highlighter as handwriting', () => {
    expect(
      classifyImage({ words: 1, confidence: 40, textAreaRatio: 0.05 }, measureImage(redRing)),
    ).toBe('handwriting');
    expect(
      classifyImage({ words: 2, confidence: 30, textAreaRatio: 0.2 }, measureImage(highlight)),
    ).toBe('handwriting');
  });

  it('finds a ruled grid as a table, but not a dark film', () => {
    const stats = measureImage(ruled);
    expect(stats.rows.length).toBeGreaterThanOrEqual(3);
    expect(stats.columns.length).toBeGreaterThanOrEqual(2);
    expect(classifyImage(noWords, stats)).toBe('table');
    expect(measureImage(film).rows).toEqual([]);
    expect(classifyImage(noWords, measureImage(film))).toBe('figure');
  });

  it('reads a labelled diagram or photo as no text picture: many tones outside the words', () => {
    const outsideWords = measureImage(film);
    expect(classifyImage(typed, measureImage(printedText), outsideWords)).not.toBe('text_picture');
    const plainOutside = measureImage(paint(50, 50, () => WHITE));
    expect(classifyImage(typed, measureImage(printedText), plainOutside)).toBe('text_picture');
  });

  it('leaves a plain picture with a few words unsure', () => {
    const fewWords = { words: 2, confidence: 85, textAreaRatio: 0.05 };
    expect(classifyImage(fewWords, measureImage(printedText))).toBe('unsure');
  });

  it('measures only what the skip mask leaves', () => {
    const half = new Uint8Array(200 * 100).fill(1, 0, 200 * 50);
    const blackTop = paint(200, 100, (_, y) => (y < 50 ? BLACK : WHITE));
    expect(measureImage(blackTop).darkShare).toBeCloseTo(0.5);
    expect(measureImage(blackTop, half).darkShare).toBe(0);
  });
});
