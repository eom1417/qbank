import { describe, expect, it } from 'vitest';
import {
  combineTags,
  isTagLine,
  takeTags,
} from '../../../src/server/capabilities/sources/domain/pipeline/tags.js';

// Q53: an exam-and-year label is a filter tag, never stem or explanation text.
describe('exam tags', () => {
  it('reads a tag line with one year or several', () => {
    expect(isTagLine('Part II 2019')).toBe(true);
    expect(isTagLine('(Part I 2017, 2022)')).toBe(true);
    expect(takeTags('Part I 2017, 2022').tags).toEqual({ exam: 'Part I', year: '2017, 2022' });
  });

  it('takes a tag out of a stem and keeps the rest', () => {
    const read = takeTags('Which drug is first? part ii 2018');
    expect(read).toEqual({ tags: { exam: 'Part II', year: '2018' }, rest: 'Which drug is first?' });
  });

  it('leaves text without a tag alone', () => {
    expect(isTagLine('Part of the answer')).toBe(false);
    expect(takeTags('Given in 2019 to a child')).toEqual({
      tags: { exam: null, year: null },
      rest: 'Given in 2019 to a child',
    });
  });

  it('combines several tags of one question, each value once', () => {
    const tags = [
      { exam: 'Part II', year: '2017' },
      { exam: 'Part II', year: '2023' },
      { exam: null, year: null },
    ];
    expect(combineTags(tags)).toEqual({ exam: 'Part II', year: '2017, 2023' });
  });
});
