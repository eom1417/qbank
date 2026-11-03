import { describe, expect, it } from 'vitest';
import { parseTrace } from '../../../src/server/capabilities/sources/adapters/placed-images.js';
import {
  horizontalRules,
  inkWithoutWords,
  ruledTables,
} from '../../../src/server/capabilities/sources/domain/ink-regions.js';
import { figuresFromImages } from '../../../src/server/capabilities/sources/domain/media-regions.js';

const page = (
  words: { text: string; box: { x0: number; y0: number; x1: number; y1: number } }[],
) => ({
  page: 1,
  width: 600,
  height: 800,
  visual: true,
  words: words.map((word) => ({ ...word, font: 'Times' })),
});
const box = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

describe('pictures embedded in a text page (M5.1)', () => {
  it('reads where MuPDF draws each image and its own pixel size', () => {
    const trace = [
      '<page number="3" mediabox="0 0 612 865">',
      '<fill_image alpha="1" transform="300 0 0 100 40 200" width="600" height="200"/>',
    ].join('\n');
    expect(parseTrace(trace).get(3)).toEqual([
      { box: box(40, 200, 340, 300), pixelWidth: 600, pixelHeight: 200 },
    ]);
  });

  it('keeps figures, not specks, page backgrounds, overlay tiles or images over text', () => {
    const text = page(
      Array.from({ length: 5 }, (_, i) => ({
        text: 'word',
        box: box(100, 600 + i * 14, 130, 610 + i * 14),
      })),
    );
    const image = (b: ReturnType<typeof box>, pixels = 400) => ({
      box: b,
      pixelWidth: pixels,
      pixelHeight: pixels,
    });
    const figures = figuresFromImages(text, [
      image(box(40, 40, 340, 240), 600),
      image(box(10, 10, 20, 20)),
      image(box(0, 0, 600, 800)),
      image(box(0, 300, 200, 500), 512),
      image(box(200, 300, 400, 500), 512),
      image(box(90, 590, 300, 700)),
    ]);
    expect(figures).toEqual([{ page: 1, box: box(40, 40, 340, 240), kind: 'figure', ppi: 144 }]);
  });
});

describe('ruled tables (M5.5)', () => {
  it('finds rules stacked with words between, and not a lone underline', () => {
    const width = 600;
    const height = 400;
    const pixels = new Uint8Array(width * height).fill(255);
    for (const y of [100, 130, 160, 190]) pixels.fill(0, y * width + 50, y * width + 350);
    pixels.fill(0, 300 * width + 50, 300 * width + 350);
    const raster = { width, height, scale: 1, pixels };
    const words = ['Sodium', '128', 'Potassium', '6.1', 'Glucose', '3.2'].map((text, i) => ({
      text,
      box: box(
        60 + (i % 2) * 150,
        110 + Math.floor(i / 2) * 30,
        120 + (i % 2) * 150,
        122 + Math.floor(i / 2) * 30,
      ),
    }));
    const sheet = { ...page(words), height };
    const rules = horizontalRules(inkWithoutWords(raster, sheet), raster);
    expect(ruledTables(sheet, rules)).toEqual([
      { page: 1, box: box(50, 100, 350, 191), kind: 'table', ppi: null },
    ]);
  });
});
