import { describe, expect, it } from 'vitest';
import { modalityOf } from '../../../src/server/capabilities/sources/domain/media-description.js';
import { withinBookLimits } from '../../../src/server/capabilities/sources/domain/media-limits.js';
import { linkMedia } from '../../../src/server/capabilities/sources/domain/media-links.js';
import { qualityOf } from '../../../src/server/capabilities/sources/domain/media-quality.js';

const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });
const line = (page: number, y: number, x1 = 400) => ({ page, box: box(50, y, x1, y + 12) });
const figure = (page: number, y0: number, y1: number, x0 = 50, x1 = 250) => ({
  page,
  box: box(x0, y0, x1, y1),
  kind: 'figure' as const,
  ppi: 150,
});
const linked = (links: ReturnType<typeof linkMedia>) =>
  links.map((link) => [link.question, link.certain]);

describe('linking a picture to its question (M5.2, M5.3)', () => {
  const questions = [
    { stem: 'What does this ECG show?', spans: [line(1, 50), line(1, 200, 90), line(1, 215, 90)] },
    { stem: 'Which side is abnormal?', spans: [line(1, 300), line(2, 60, 90)] },
    { stem: 'The rash shown above is?', spans: [line(2, 400), line(2, 415, 90)] },
  ];

  it('is certain among its lines, side by side, or after a page break', () => {
    const links = linkMedia(
      [figure(1, 70, 190), figure(1, 70, 190, 260, 380), figure(2, 10, 50)],
      questions,
    );
    expect(linked(links)).toEqual([
      [0, true],
      [0, true],
      [1, true],
    ]);
  });

  it('between questions is only a suggestion: announced by the next stem, else the previous', () => {
    expect(linked(linkMedia([figure(2, 200, 380)], questions))).toEqual([[2, false]]);
    const plain = questions.map((q) => ({ ...q, stem: 'Which is right?' }));
    expect(linked(linkMedia([figure(2, 200, 380)], plain))).toEqual([[1, false]]);
    expect(linkMedia([figure(1, 70, 190)], [])).toEqual([]);
  });
});

describe('what is kept and how it is described (M5.4, M5.6, M5.8)', () => {
  it('never keeps most of a page nor too many pictures for one question', () => {
    const big = { region: figure(1, 0, 500, 0, 600), question: 0, certain: true };
    const small = { region: figure(1, 600, 700), question: 1, certain: true };
    const { kept, dropped } = withinBookLimits([small, big], () => 600 * 800);
    expect([kept, dropped]).toEqual([[small], [big]]);
  });

  it('names the picture only from the stem, never from the options', () => {
    expect(modalityOf('figure', 'What does this ECG show?')).toBe('ecg');
    expect(modalityOf('figure', 'ما تشخيص صورة الأشعة السينية؟')).toBe('xray');
    expect(modalityOf('figure', 'Which is the answer?')).toBeNull();
    expect(modalityOf('table', 'Lab results')).toBe('table');
  });

  it('marks blurry, washed-out or low-resolution pictures as poor', () => {
    const sharp = new Uint8Array(400).map((_, i) => ((i + Math.floor(i / 20)) % 2 ? 0 : 255));
    const flat = new Uint8Array(400).fill(200);
    const raster = (pixels: Uint8Array) => ({ width: 20, height: 20, scale: 1, pixels });
    expect(qualityOf(raster(sharp), 150).low).toBe(false);
    expect(qualityOf(raster(sharp), 20).low).toBe(true);
    expect(qualityOf(raster(flat), null).low).toBe(true);
  });
});
