import { describe, expect, it } from 'vitest';
import { newRegions } from '../../../../src/server/capabilities/sources/detection/link/media-regions.js';
import type { MediaRegion } from '../../../../src/server/capabilities/sources/domain/media-regions.js';

const region = (page: number, x0: number): MediaRegion => ({
  page,
  box: { x0, y0: 100, x1: x0 + 200, y1: 300 },
  kind: 'figure',
  ppi: 150,
});

describe('newRegions', () => {
  it('drops a rendered region covering a picture already read as text', () => {
    const read = [{ page: 2, box: { x0: 52, y0: 104, x1: 248, y1: 296 } }];
    expect(newRegions([region(2, 50)], read)).toEqual([]);
  });

  it('keeps a region elsewhere on the page or on another page', () => {
    const read = [{ page: 2, box: { x0: 52, y0: 104, x1: 248, y1: 296 } }];
    const kept = [region(2, 300), region(3, 50)];
    expect(newRegions(kept, read)).toEqual(kept);
  });
});
