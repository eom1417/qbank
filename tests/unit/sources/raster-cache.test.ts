import { describe, expect, it } from 'vitest';
import { rasterCache } from '../../../src/server/capabilities/sources/use-cases/extract-questions.js';

describe('page renders during an import', () => {
  it('renders a page once while in use, and keeps only the few most recent', async () => {
    const rendered: number[] = [];
    const render = async (_file: string, page: number) => {
      rendered.push(page);
      return { width: 1, height: 1, data: new Uint8Array(1), scale: 1 };
    };
    const raster = rasterCache('book.pdf', render as never);
    for (const page of [1, 1, 2, 3, 4, 5, 5, 1]) await raster(page);
    // Page 1 left the four kept (2, 3, 4, 5) and is rendered again; 5 was still kept.
    expect(rendered).toEqual([1, 2, 3, 4, 5, 1]);
  });
});
