import { describe, expect, it } from 'vitest';
import {
  mayServePicture,
  picturesBeforeReveal,
  picturesWithExplanation,
  placePictures,
  type Snapshot,
} from '../../../src/server/capabilities/exam-rules/index.js';

// M34 P1 (Z1, Z7, Z8, Q65): who sees which picture, and when.

const sharedCase = { text: 'A shared vignette.', pictureIds: ['case-1'] };
const rows = [
  { id: 'q-1', placement: 'question' as const, option_letter: null },
  { id: 'old-1', placement: null, option_letter: null },
  { id: 'opt-b', placement: 'option' as const, option_letter: 'B' },
  { id: 'exp-1', placement: 'explanation' as const, option_letter: null },
];
const { shown, placed } = placePictures(rows, sharedCase);

const base: Snapshot = {
  stem: 'Stem?',
  options: [],
  answers: ['B'],
  multiSelect: false,
  explanation: 'Because.',
  pictureIds: shown,
  placed,
  chapterId: null,
  version: 1,
};

describe('placing pictures (M34 P1)', () => {
  it('sorts pictures by placement and keeps unplaced ones only for the owner', () => {
    expect(shown).toEqual(['q-1', 'old-1']);
    expect(placed).toEqual({
      question: ['q-1'],
      options: { B: ['opt-b'] },
      explanation: ['exp-1'],
      case: sharedCase,
    });
  });

  it('never shows an explanation picture before the reveal, to anyone', () => {
    for (const audience of ['owner', 'shared'] as const) {
      const before = picturesBeforeReveal(base, audience);
      const all = [
        ...before.pictureIds,
        ...Object.values(before.optionPictureIds).flat(),
        ...(before.case?.pictureIds ?? []),
      ];
      expect(all).not.toContain('exp-1');
      expect(mayServePicture(base, 'exp-1', audience, false)).toBe(false);
      expect(mayServePicture(base, 'exp-1', audience, true)).toBe(true);
    }
    expect(picturesWithExplanation(base)).toEqual(['exp-1']);
  });

  it('shows the case with the question, and unplaced pictures only to the owner', () => {
    expect(picturesBeforeReveal(base, 'owner')).toEqual({
      pictureIds: ['q-1', 'old-1'],
      optionPictureIds: { B: ['opt-b'] },
      case: sharedCase,
    });
    expect(picturesBeforeReveal(base, 'shared').pictureIds).toEqual(['q-1']);
    expect(mayServePicture(base, 'old-1', 'shared', true)).toBe(false);
    expect(mayServePicture(base, 'case-1', 'shared', false)).toBe(true);
  });

  it('gives a share nothing from a snapshot taken before placements existed', () => {
    const old: Snapshot = { ...base, pictureIds: ['old-1', 'exp-1'] };
    delete old.placed;
    expect(picturesBeforeReveal(old, 'owner').pictureIds).toEqual(['old-1', 'exp-1']);
    expect(picturesBeforeReveal(old, 'shared')).toEqual({
      pictureIds: [],
      optionPictureIds: {},
      case: null,
    });
    expect(mayServePicture(old, 'old-1', 'shared', true)).toBe(false);
  });
});
