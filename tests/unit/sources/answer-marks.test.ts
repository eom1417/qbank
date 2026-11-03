import { describe, expect, it } from 'vitest';
import {
  inkAround,
  pickMarked,
  type Raster,
} from '../../../src/server/capabilities/sources/domain/answer-marks.js';

function blank(): Raster {
  return { width: 200, height: 200, scale: 1, pixels: new Uint8Array(200 * 200).fill(255) };
}

function ring(raster: Raster, cx: number, cy: number, r: number) {
  for (let a = 0; a < 360; a += 1) {
    const x = Math.round(cx + r * Math.cos((a * Math.PI) / 180));
    const y = Math.round(cy + r * Math.sin((a * Math.PI) / 180));
    raster.pixels[y * raster.width + x] = 40;
  }
}

const letter = { x0: 50, y0: 50, x1: 58, y1: 62 };

describe('pen marks around option letters', () => {
  it('finds a circle drawn around the letter, ignoring the printed glyph', () => {
    const page = blank();
    for (let y = 50; y <= 62; y++) for (let x = 50; x <= 58; x++) page.pixels[y * 200 + x] = 0;
    expect(inkAround(page, letter, [letter])).toBe(0);
    ring(page, 54, 56, 10);
    expect(inkAround(page, letter, [letter])).toBeGreaterThan(0.05);
  });

  it('decides only a clear winner above the ink every option shares', () => {
    expect(
      pickMarked([
        { letter: 'A', ink: 0.07 },
        { letter: 'B', ink: 0.13 },
      ])?.letter,
    ).toBe('B');
    expect(
      pickMarked([
        { letter: 'A', ink: 0.07 },
        { letter: 'B', ink: 0.075 },
      ]),
    ).toBeNull();
    const close = [
      { letter: 'A', ink: 0 },
      { letter: 'B', ink: 0.05 },
      { letter: 'C', ink: 0.04 },
    ];
    expect(pickMarked(close)).toBeNull();
    expect(pickMarked([])).toBeNull();
  });
});

describe('AI mark suggestions are untrusted', () => {
  it('accepts only a confident, visible mark on a real option', async () => {
    const { acceptedMark } =
      await import('../../../src/server/capabilities/sources/domain/mark-suggestion.js');
    const letters = ['A', 'B', 'C'];
    expect(acceptedMark({ marked: 'b', mark: 'circle', confident: true }, letters)).toBe('B');
    expect(acceptedMark({ marked: 'B', mark: 'circle', confident: false }, letters)).toBeNull();
    expect(acceptedMark({ marked: 'B', mark: 'none', confident: true }, letters)).toBeNull();
    expect(acceptedMark({ marked: 'E', mark: 'tick', confident: true }, letters)).toBeNull();
    expect(acceptedMark({ marked: null, mark: 'circle', confident: true }, letters)).toBeNull();
  });
});
