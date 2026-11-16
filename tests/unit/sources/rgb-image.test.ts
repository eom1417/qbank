import { describe, expect, it } from 'vitest';
import { parsePpm } from '../../../src/server/capabilities/sources/domain/pipeline/rgb-image.js';

describe('PPM reading (M34 pipeline)', () => {
  it('reads a binary PPM with a comment', () => {
    const pixels = Buffer.from([255, 0, 0, 0, 255, 0]);
    const file = Buffer.concat([Buffer.from('P6\n# made by poppler\n2 1\n255\n', 'ascii'), pixels]);
    expect(parsePpm(file)).toEqual({ width: 2, height: 1, data: pixels });
  });

  it('refuses other formats and truncated files', () => {
    expect(() => parsePpm(Buffer.from('P5\n1 1\n255\n\0'))).toThrow('not a binary PPM');
    expect(() => parsePpm(Buffer.from('P6\n2 2\n255\n\0\0\0'))).toThrow('truncated');
  });
});
