import { describe, expect, it } from 'vitest';
import { scanText } from '../../../src/server/capabilities/sources/adapters/pipeline-units.js';

describe('reading a scanned page (M34)', () => {
  it('gives an unreadable page no words instead of failing the whole file', async () => {
    const page = { page: 3, width: 600, height: 800, words: [] };
    const read = await scanText('/nonexistent/file.pdf', page);
    expect(read).toEqual({ page: 3, width: 600, height: 800, words: [] });
  });
});
