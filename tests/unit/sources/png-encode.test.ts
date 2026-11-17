import { crc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePng } from '../../../src/server/capabilities/sources/adapters/png-encode.js';
import {
  composeSheet,
  drawSheet,
} from '../../../src/server/capabilities/sources/adapters/sheet-image.js';

interface Chunk {
  type: string;
  data: Buffer;
  crc: number;
}

/** The data of the chunk at `index` (throws when the file has fewer chunks). */
function dataOf(png: Buffer, index: number): Buffer {
  const chunk = chunksOf(png)[index];
  if (!chunk) throw new Error(`no chunk ${index}`);
  return chunk.data;
}

function chunksOf(png: Buffer): Chunk[] {
  const chunks: Chunk[] = [];
  for (let at = 8; at < png.length;) {
    const length = png.readUInt32BE(at);
    const type = png.subarray(at + 4, at + 8).toString('ascii');
    const data = png.subarray(at + 8, at + 8 + length);
    chunks.push({ type, data, crc: png.readUInt32BE(at + 8 + length) });
    at += 12 + length;
  }
  return chunks;
}

const solid = (width: number, height: number, value: number) => ({
  width,
  height,
  data: Buffer.alloc(width * height * 3, value),
});

describe('PNG encoding with zlib (M34 P3)', () => {
  it('writes the signature, IHDR, IDAT and IEND with valid CRCs and the exact pixels', () => {
    const pixels = Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 9, 8, 7]);
    const png = encodePng({ width: 2, height: 2, data: pixels });
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const chunks = chunksOf(png);
    expect(chunks.map((chunk) => chunk.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
    for (const chunk of chunks) {
      expect(chunk.crc).toBe(crc32(Buffer.concat([Buffer.from(chunk.type), chunk.data])));
    }
    const ihdr = dataOf(png, 0);
    expect([ihdr.readUInt32BE(0), ihdr.readUInt32BE(4), ihdr[8], ihdr[9], ihdr[12]]).toEqual([
      2, 2, 8, 2, 0,
    ]);
    const raw = inflateSync(dataOf(png, 1));
    expect(raw).toEqual(
      Buffer.concat([
        Buffer.from([0]),
        pixels.subarray(0, 6),
        Buffer.from([0]),
        pixels.subarray(6),
      ]),
    );
  });

  it('refuses pixels that do not match the size', () => {
    expect(() => encodePng({ width: 2, height: 2, data: Buffer.alloc(5) })).toThrow(
      'does not match',
    );
  });

  it('composes a sheet: white background, framed cells, black number, the crop inside', () => {
    const crops = [solid(100, 50, 200), solid(30, 60, 50)];
    const canvas = drawSheet(crops, 700);
    expect(Math.max(canvas.width, canvas.height)).toBeLessThanOrEqual(700);
    const values = new Set(canvas.data);
    for (const value of [255, 128, 0, 200, 50]) expect(values.has(value)).toBe(true);
    const sheet = composeSheet(crops, 700);
    const ihdr = dataOf(sheet.png, 0);
    expect([ihdr.readUInt32BE(0), ihdr.readUInt32BE(4)]).toEqual([sheet.width, sheet.height]);
    expect(inflateSync(dataOf(sheet.png, 1)).length).toBe((sheet.width * 3 + 1) * sheet.height);
  });
});
