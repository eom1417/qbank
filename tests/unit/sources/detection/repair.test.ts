import { beforeEach, expect, it, vi } from 'vitest';
import type { FileUnits } from '../../../../src/server/capabilities/sources/adapters/pipeline-units.js';
import {
  readByOcr,
  readTextLayer,
} from '../../../../src/server/capabilities/sources/adapters/readers.js';
import { defaultLinesReader } from '../../../../src/server/capabilities/sources/detection/lines/read-lines.js';
import type {
  PageText,
  PageWord,
} from '../../../../src/server/capabilities/sources/domain/page.js';

vi.mock('../../../../src/server/capabilities/sources/adapters/readers.js', async (original) => ({
  ...(await original<object>()),
  readTextLayer: vi.fn(),
  readByOcr: vi.fn(),
}));

const units = {
  pages: [{ size: { page: 3, width: 600, height: 800 }, scanned: false, units: [] }],
} as unknown as FileUnits;
const wordAt = (text: string, y: number): PageWord => ({
  text,
  box: { x0: 36, y0: y, x1: 190, y1: y + 12 },
  font: 'TimesNewRomanPSMT',
});
const pageOf = (words: PageWord[]): PageText => ({ page: 3, width: 600, height: 800, words });
beforeEach(() => vi.clearAllMocks());

it('repairs only broken glyph lines with OCR before detection reads their roles', async () => {
  const printed = wordAt('A. intact choice', 100);
  const broken = pageOf([printed, wordAt('�. unreadable choice', 130)]);
  const replacement = wordAt('B. recovered choice', 130);
  vi.mocked(readTextLayer).mockResolvedValue([broken]);
  vi.mocked(readByOcr).mockResolvedValue(
    pageOf([wordAt('wrong OCR for intact text', 100), replacement]),
  );
  const pages = await defaultLinesReader.pages('synthetic.pdf', units);
  expect(pages[0]?.words).toEqual([printed, replacement]);
  expect(readByOcr).toHaveBeenCalledExactlyOnceWith('synthetic.pdf', 3);
});

it('keeps clean text unchanged without spending an OCR call', async () => {
  const page = pageOf([wordAt('B. clear text', 130)]);
  vi.mocked(readTextLayer).mockResolvedValue([page]);
  expect(await defaultLinesReader.pages('clean.pdf', units)).toEqual([page]);
  expect(readByOcr).not.toHaveBeenCalled();
});

it('propagates a repair failure instead of silently accepting damaged text', async () => {
  vi.mocked(readTextLayer).mockResolvedValue([pageOf([wordAt('�. lost label', 130)])]);
  vi.mocked(readByOcr).mockRejectedValue(new Error('OCR unavailable'));
  await expect(defaultLinesReader.pages('damaged.pdf', units)).rejects.toThrow('OCR unavailable');
});
