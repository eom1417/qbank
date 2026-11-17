import { describe, expect, it } from 'vitest';
import type { TextLine } from '../../../src/server/capabilities/sources/domain/lines.js';
import type { Box, PageWord } from '../../../src/server/capabilities/sources/domain/page.js';
import {
  anchorPictureLines,
  boxOptions,
  joinLoneLabels,
  markedLetters,
  pictureKey,
  readingScore,
  wantsSecondReading,
} from '../../../src/server/capabilities/sources/domain/pipeline/picture-lines.js';
import type { Unit } from '../../../src/server/capabilities/sources/domain/pipeline/units.js';
import {
  pageFlow,
  parserLines,
  pictureKeys,
  readVirtual,
  readsAsText,
  virtualText,
} from '../../../src/server/capabilities/sources/domain/pipeline/virtual-text.js';

// Synthetic lines and units only: no owner file content.
const SIZE = { page: 1, width: 600, height: 800 };
const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 });

/** Words of one row, 6 points per character, from `x`. */
function rowWords(text: string, x: number, y: number): PageWord[] {
  let at = x;
  return text.split(' ').map((word) => {
    const placed = { text: word, box: box(at, y, at + word.length * 6, y + 10), font: null };
    at += word.length * 6 + 4;
    return placed;
  });
}

const line = (text: string, x: number, y: number, page = 1): TextLine => {
  const words = rowWords(text, x, y);
  const lineBox = box(x, y, words.at(-1)?.box.x1 ?? x, y + 10);
  return { page, text, box: lineBox, words, rtl: false, start: x };
};

const unit = (id: string, kind: Unit['kind'], at: Box, extra: Partial<Unit> = {}): Unit => ({
  id,
  page: 1,
  box: at,
  kind,
  text: null,
  ocr: null,
  imageClass: null,
  fingerprint: null,
  order: 0,
  filler: null,
  source: kind === 'image' ? 'image' : 'text_layer',
  ...extra,
});

const picture = (id: string, at: Box, words: number, imageClass: Unit['imageClass']) =>
  unit(id, 'image', at, { imageClass, ocr: { words, confidence: 90 } });

describe('picture lines (D6.1)', () => {
  it('joins a label printed alone above its text, and an answer word above its letter', () => {
    const lines = [line('A', 60, 100), line('First choice', 60, 112), line('Answer', 60, 140)];
    const joined = joinLoneLabels([...lines, line('B', 60, 152)]).map((l) => l.text);
    expect(joined).toEqual(['A. First choice', 'Answer: B']);
  });

  it('leaves a lone label alone when the next line is not under it', () => {
    const joined = joinLoneLabels([line('A', 60, 100), line('far away', 300, 300)]);
    expect(joined.map((l) => l.text)).toEqual(['A', 'far away']);
  });

  it('gives boxed options positional letters only when two or more follow a question', () => {
    const lines = [
      line('7. Which one?', 60, 100),
      line('O Alpha', 60, 112),
      line('○ Beta', 60, 124),
    ];
    expect(boxOptions(lines).map((l) => l.text)).toEqual(['7. Which one?', 'A. Alpha', 'B. Beta']);
    const single = [line('7. Which one?', 60, 100), line('O Alpha', 60, 112)];
    expect(boxOptions(single).map((l) => l.text)).toEqual(['7. Which one?', 'O Alpha']);
  });

  it('anchors another bank’s numbering, "Question N/M" and an unnumbered stem before options', () => {
    const numbered = anchorPictureLines([
      line('82. Pick one', 60, 100),
      line('a) x', 60, 112),
      line('b) y', 60, 124),
    ]);
    expect(numbered[0]?.text).toBe('Q82) Pick one');
    expect(anchorPictureLines([line('Question 28/61', 60, 100)])[0]?.text).toBe('Q28) ');
    const bare = anchorPictureLines([
      line('Pick one', 60, 100),
      line('a) x', 60, 112),
      line('b) y', 60, 124),
    ]);
    expect(bare[0]?.text).toBe('Q0) Pick one');
  });

  it('does not anchor a numbered line without options, nor a key with its explanation', () => {
    const lines = [line('12. a) because of this', 60, 100), line('13. plain note', 60, 112)];
    expect(anchorPictureLines(lines).map((l) => l.text)).toEqual(lines.map((l) => l.text));
    expect(pictureKey('12. b) because of this')).toEqual({
      number: 12,
      letter: 'B',
      text: 'because of this',
    });
    expect(pictureKey('Q12) b) not a key')).toBeNull();
  });
});

describe('second readings and tolerant letters (D2.2)', () => {
  it('reads boxed and dashed letters as option labels', () => {
    const lines = [
      line('○ A Alpha', 60, 100),
      line('□ b) Beta', 60, 112),
      line('C- Gamma', 60, 124),
    ];
    expect(markedLetters(lines).map((l) => l.text)).toEqual(['A. Alpha', 'b. Beta', 'C. Gamma']);
    expect(markedLetters([line('0 Asthma attack', 60, 100)])[0]?.text).toBe('0 Asthma attack');
  });

  it('asks for a second reading when a numbered stem shows fewer than two options', () => {
    const stemOnly = rowWords('12. Which one is right?', 60, 100);
    const withOptions = [
      ...stemOnly,
      ...rowWords('a) Yes', 60, 114),
      ...rowWords('b) No', 60, 128),
    ];
    expect(wantsSecondReading(stemOnly)).toBe(true);
    expect(wantsSecondReading(withOptions)).toBe(false);
    expect(wantsSecondReading(rowWords('Plain caption of a figure', 60, 100))).toBe(false);
    expect(readingScore(withOptions)).toBeGreaterThan(readingScore(stemOnly));
  });
});

describe('page flow and covers', () => {
  it('moves a picture pasted beside printed lines after the last of them', () => {
    const units = [
      unit('stem', 'text_line', box(40, 100, 300, 110)),
      picture('side', box(350, 115, 560, 160), 9, 'text_picture'),
      unit('optA', 'text_line', box(40, 120, 120, 130)),
      unit('optB', 'text_line', box(40, 140, 120, 150)),
    ];
    expect(pageFlow(units).map((u) => u.id)).toEqual(['stem', 'optA', 'optB', 'side']);
  });

  it('takes an image over printed lines for a cover, but not one a line only touches', () => {
    const inside = unit('inside', 'text_line', box(40, 150, 200, 160));
    const edge = unit('edge', 'text_line', box(40, 292, 200, 302));
    const over = picture('over', box(30, 100, 400, 200), 9, 'text_picture');
    const above = picture('above', box(30, 0, 400, 300), 9, 'text_picture');
    const covers = (units: Unit[]) => virtualText([{ size: SIZE, units }], [], []).covers;
    expect([...covers([over, inside])]).toEqual(['over']);
    expect([...covers([{ ...above, box: box(30, 100, 400, 300) }, edge])]).toEqual([]);
  });

  it('reads only pictures with words worth reading', () => {
    expect(readsAsText(picture('a', box(0, 0, 9, 9), 9, 'text_picture'))).toBe(true);
    expect(readsAsText(picture('b', box(0, 0, 9, 9), 9, 'figure'))).toBe(false);
    expect(readsAsText(picture('c', box(0, 0, 9, 9), 1, 'unsure'))).toBe(false);
  });
});

/** A typed question on page 1; on page 3 a picture holding a second question, and a note. */
function sample() {
  const layer = [
    line('Q1) What is first?', 40, 100),
    line('A. One', 40, 115),
    line('B. Two', 40, 130),
  ];
  const pages = [
    { size: SIZE, units: layer.map((l, i) => unit(`t${i}`, 'text_line', l.box)) },
    {
      size: { ...SIZE, page: 3 },
      units: [
        picture('pic', box(40, 400, 400, 470), 12, 'text_picture'),
        unit('note', 'text_line', box(300, 500, 340, 510), { source: 'off_body_font' }),
      ].map((u) => ({ ...u, page: 3 })),
    },
  ];
  const words = [
    ...rowWords('82. Which is second?', 42, 402),
    ...rowWords('a) Red', 52, 416),
    ...rowWords('b) Blue', 52, 430),
  ];
  return virtualText(pages, layer, [{ unitId: 'pic', words }]);
}

describe('virtual text', () => {
  it('puts a picture’s lines at its place in reading order and leaves handwriting out', () => {
    const text = sample();
    expect(text.lines.map((l) => [l.unitId, l.fromPicture])).toEqual([
      ['t0', false],
      ['t1', false],
      ['t2', false],
      ['pic', true],
      ['pic', true],
      ['pic', true],
    ]);
    expect(text.lines[3]?.line.text).toBe('Q82) Which is second?');
    expect(text.order.get('pic')).toBe(3);
    expect(text.order.get('note')).toBe(5.5);
  });

  it('reads questions from the page and from the picture through the rule parser', () => {
    const text = sample();
    const reading = readVirtual(
      text,
      new Map([
        [1, 800],
        [3, 800],
      ]),
      [],
    );
    expect(reading.questions.map((q) => [q.number, q.options.length])).toEqual([
      [1, 2],
      [82, 2],
    ]);
    expect([...reading.consumed].sort()).toEqual(['pic', 't0', 't1', 't2']);
  });

  it('closes open text at a picture’s edge', () => {
    const text = sample();
    const lines = parserLines(
      text,
      text.lines.map((l) => l.line),
    );
    expect(lines.map((l) => l.text).filter((t) => t.startsWith('~'))).toHaveLength(1);
  });
});

describe('pictures that are not the file’s questions', () => {
  it('drops a picture question pasted under a typed question as an excerpt', () => {
    const layer = [line('Q1) Typed?', 40, 100), line('A. One', 40, 115), line('B. Two', 40, 130)];
    const units = [
      ...layer.map((l, i) => unit(`t${i}`, 'text_line', l.box)),
      picture('pic', box(40, 140, 400, 200), 12, 'text_picture'),
    ];
    const words = [
      ...rowWords('40. Other bank?', 42, 150),
      ...rowWords('a) x', 52, 164),
      ...rowWords('b) y', 52, 178),
    ];
    const text = virtualText([{ size: SIZE, units }], layer, [{ unitId: 'pic', words }]);
    const reading = readVirtual(text, new Map([[1, 800]]), []);
    expect(reading.questions.map((q) => q.number)).toEqual([1]);
    expect(reading.consumed.has('pic')).toBe(false);
  });

  it('attaches a printed key after an exam tag line, and reads a doubtful key apart', () => {
    const layer = [
      line('Q1) First?', 40, 100),
      line('A. One', 40, 115),
      line('Part II 2019', 40, 160),
      line('Correct answer: A', 40, 185),
      line('Q2) Second?', 40, 230),
      line('A. One', 40, 245),
      line('B. Two', 40, 260),
      line('Correct answer: B?', 40, 300),
    ];
    const units = layer.map((l, i) => unit(`t${i}`, 'text_line', l.box));
    const text = virtualText([{ size: SIZE, units }], layer, []);
    const reading = readVirtual(text, new Map([[1, 800]]), []);
    expect(reading.keys.map((k) => k.key)).toEqual([['A'], null]);
    expect([...reading.free].sort()).toEqual([2, 7]);
  });
});

describe('keys printed in screenshots', () => {
  it('gives a key printed in the answer panel beside a screenshot to that screenshot', () => {
    const units = [
      picture('answer', box(320, 90, 560, 140), 6, 'text_picture'),
      picture('question', box(40, 100, 300, 160), 9, 'text_picture'),
    ];
    const answer = [
      ...rowWords('Correct Answer: B', 322, 92),
      ...rowWords('Because of blue.', 322, 106),
    ];
    const question = [
      ...rowWords('82. Which colour?', 42, 102),
      ...rowWords('a) Red', 52, 116),
      ...rowWords('b) Blue', 52, 130),
    ];
    const text = virtualText(
      [{ size: SIZE, units }],
      [],
      [
        { unitId: 'answer', words: answer },
        { unitId: 'question', words: question },
      ],
    );
    const reading = readVirtual(text, new Map([[1, 800]]), []);
    expect(reading.questions.map((q) => q.number)).toEqual([82]);
    expect(reading.keys[0]?.key).toEqual(['B']);
  });

  it('finds keys printed in pictures for numbers the file has', () => {
    const units = [picture('keys', box(40, 100, 400, 140), 9, 'text_picture')];
    const words = [...rowWords('82. d) because', 42, 102), ...rowWords('more words', 52, 116)];
    const text = virtualText([{ size: SIZE, units }], [], [{ unitId: 'keys', words }]);
    expect(pictureKeys(text, new Set([82]))).toEqual([
      { unitId: 'keys', number: 82, letter: 'D', text: 'because more words' },
    ]);
    expect(pictureKeys(text, new Set([83]))).toEqual([]);
  });
});
