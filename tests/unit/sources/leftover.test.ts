import { describe, expect, it } from 'vitest';
import type { PageWord } from '../../../src/server/capabilities/sources/domain/page.js';
import {
  findLeftovers,
  looksLikeQuestion,
} from '../../../src/server/capabilities/sources/domain/pipeline/leftover.js';
import type { QuestionFrame } from '../../../src/server/capabilities/sources/domain/pipeline/placement.js';
import type { Unit } from '../../../src/server/capabilities/sources/domain/pipeline/units.js';
import type { VirtualText } from '../../../src/server/capabilities/sources/domain/pipeline/virtual-text.js';

// Synthetic OCR words only: pictures that look like a question but gave none (for P4b).
function words(rows: string[]): PageWord[] {
  return rows.flatMap((row, index) =>
    row.split(' ').map((text, i) => ({
      text,
      box: { x0: 40 + i * 40, y0: 100 + index * 14, x1: 75 + i * 40, y1: 110 + index * 14 },
      font: null,
    })),
  );
}

const picture = (id: string, rows: string[], extra: Partial<Unit> = {}): Unit => ({
  id,
  page: 1,
  box: { x0: 30, y0: 90, x1: 500, y1: 200 },
  kind: 'image',
  text: rows.join('\n'),
  ocr: { words: rows.length * 3, confidence: 90 },
  imageClass: 'text_picture',
  fingerprint: null,
  order: 0,
  filler: null,
  source: 'image',
  words: words(rows),
  ...extra,
});

const frame = (stemAt: number): QuestionFrame => ({
  number: 1,
  stem: 'Typed?',
  stemAt,
  endAt: stemAt + 2,
  options: [],
  spans: [],
});

const textOf = (units: [Unit, number][]): VirtualText => ({
  lines: [],
  order: new Map(units.map(([unit, at]) => [unit.id, at])),
  units: new Map(units.map(([unit]) => [unit.id, unit])),
  covers: new Set(),
});

describe('leftovers for the vision lesson', () => {
  it('sees a numbered stem, two options or a question mark, but not a key or a caption', () => {
    expect(looksLikeQuestion(1, words(['12. Which one']))).toBe(true);
    expect(looksLikeQuestion(1, words(['a) red', 'b) blue']))).toBe(true);
    expect(looksLikeQuestion(1, words(['Which one is right?']))).toBe(true);
    expect(looksLikeQuestion(1, words(['12. b) because of this']))).toBe(false);
    expect(looksLikeQuestion(1, words(['Fig. 2 A made-up rash']))).toBe(false);
  });

  it('lists unread question-like pictures with numbered lines and the question before', () => {
    const shot = picture('shot', ['Which colour is right?', 'O red', 'O blue']);
    const blank = picture('blank', [], { ocr: { words: 0, confidence: 0, unreadable: true } });
    const read = picture('read', ['7. Read already?']);
    const left = findLeftovers({
      text: textOf([
        [shot, 5.5],
        [blank, 0.5],
        [read, 6.5],
      ]),
      frames: [frame(3)],
      keys: ['1-3-0'],
      fromPicture: new Set([0]),
      consumed: new Set(['read']),
    });
    expect(left.map((l) => [l.unitId, l.before, l.lines.map((line) => line.n)])).toEqual([
      ['shot', '1-3-0', [1, 2, 3]],
      ['blank', null, []],
    ]);
    expect(left[0]?.lines[0]?.text).toBe('Which colour is right?');
  });

  it('leaves pictures after a typed question to its explanation', () => {
    const shot = picture('shot', ['40. Another bank?', 'a) x', 'b) y']);
    const left = findLeftovers({
      text: textOf([[shot, 5.5]]),
      frames: [frame(3)],
      keys: ['1-3-0'],
      fromPicture: new Set(),
      consumed: new Set(),
    });
    expect(left).toEqual([]);
  });
});
