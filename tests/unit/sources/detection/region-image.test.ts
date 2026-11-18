import { expect, it, vi } from 'vitest';
import { regionImage } from '../../../../src/server/capabilities/sources/detection/assist/region-image.js';
import type { FileLines } from '../../../../src/server/capabilities/sources/detection/contract.js';

it('crops the source pixels for OCR doubts and skips clean text', async () => {
  const file = {
    lines: [{ id: 0, page: 2, source: 'ocr', box: { x0: 10, y0: 20, x1: 80, y1: 40 } }],
    pages: [{ page: 2 }],
  } as unknown as FileLines;
  const render = vi.fn(async () => ({ width: 2, height: 2, data: Buffer.alloc(12, 255) }));
  expect((await regionImage('sample.pdf', file, [0], render))?.image.width).toBe(2);
  expect(render).toHaveBeenCalledWith('sample.pdf', 2, file.lines[0]?.box, 150);
  render.mockClear();
  const text = { ...file, lines: file.lines.map((line) => ({ ...line, source: 'text' as const })) };
  expect(await regionImage('sample.pdf', text, [0], render)).toBeNull();
  expect(render).not.toHaveBeenCalled();
});
