import { describe, expect, it } from 'vitest';
import type { FileUnits } from '../../../../src/server/capabilities/sources/adapters/pipeline-units.js';
import {
  linesOf,
  readLines,
} from '../../../../src/server/capabilities/sources/detection/lines/read-lines.js';
import {
  unionBox,
  type Box,
  type PageText,
  type PageWord,
} from '../../../../src/server/capabilities/sources/domain/page.js';
import { familyOf } from '../../../../src/server/capabilities/sources/domain/pipeline/family.js';
import type { Unit } from '../../../../src/server/capabilities/sources/domain/pipeline/units.js';

// M39 step 2 on synthetic pages and units only: no owner file content.
const SIZE = { page: 1, width: 600, height: 800 };

/** Words of one row, 6 points per character, from `x`, `height` points high. */
function row(text: string, x: number, y: number, font: string | null = null): PageWord[] {
  let at = x;
  return text.split(' ').map((word) => {
    const placed = {
      text: word,
      box: { x0: at, y0: y, x1: at + word.length * 6, y1: y + 10 },
      font,
    };
    at += word.length * 6 + 4;
    return placed;
  });
}

let next = 0;
function unit(kind: Unit['kind'], box: Box, extra: Partial<Unit> = {}): Unit {
  return {
    id: `u${next}`,
    page: 1,
    box,
    kind,
    text: null,
    ocr: null,
    imageClass: null,
    fingerprint: null,
    order: next++,
    filler: null,
    source: kind === 'image' ? 'image' : 'text_layer',
    ...extra,
  };
}

const fileUnits = (units: Unit[], scanned = false): FileUnits => ({
  pages: [{ size: SIZE, scanned, units }],
  family: familyOf([SIZE], units),
});

const page = (words: PageWord[]): PageText => ({ ...SIZE, words });
const wordCount = (lines: { words: unknown[] }[]) => lines.reduce((n, l) => n + l.words.length, 0);

describe('readLines (M39 step 2)', () => {
  it('reads a picture between two text lines in its place, every word once', async () => {
    const first = row('1. Which drug is first?', 36, 100);
    const second = row('A. aspirin now', 36, 114);
    const last = row('B. heparin later', 36, 300);
    const inPicture = [...row('Figure shows a rash', 60, 150), ...row('on the left arm', 60, 170)];
    const units = [
      unit('text_line', unionBox(first.map((w) => w.box))),
      unit('text_line', unionBox(second.map((w) => w.box))),
      unit(
        'image',
        { x0: 50, y0: 140, x1: 400, y1: 200 },
        {
          imageClass: 'text_picture',
          ocr: { words: inPicture.length, confidence: 88 },
          words: inPicture,
        },
      ),
      unit('text_line', unionBox(last.map((w) => w.box))),
    ];
    const pages = [page([...first, ...second, ...last])];
    const read = await readLines('any', {
      units: () => Promise.resolve(fileUnits(units)),
      pages: () => Promise.resolve(pages),
    });
    expect(read.lines.map((l) => [l.id, l.text, l.source])).toEqual([
      [0, '1. Which drug is first?', 'text'],
      [1, 'A. aspirin now', 'text'],
      [2, 'Figure shows a rash', 'picture'],
      [3, 'on the left arm', 'picture'],
      [4, 'B. heparin later', 'text'],
    ]);
    expect(read.lines[2]?.unitId).toBe(units[2]?.id);
    expect(read.lines[2]?.confidence).toBe(88);
    expect(read.lines[0]?.confidence).toBeNull();
    expect(wordCount(read.lines)).toBe(
      first.length + second.length + last.length + inPicture.length,
    );
  });
});

describe('words outside the body text (M39 step 2)', () => {
  it('keeps a word typed on a device as its own note line', () => {
    const body = [
      ...row('1. Which nerve supplies the deltoid muscle?', 36, 100, 'ABCDEF+TimesNewRomanPSMT'),
      ...row('A. axillary nerve', 36, 114, 'TimesNewRomanPS-BoldMT'),
    ];
    const note = row('remember', 400, 160, '.SFUI-Regular');
    const read = linesOf(fileUnits([]), [page([...body, ...note])]);
    const notes = read.lines.filter((l) => l.deviceNote);
    expect(notes.map((l) => l.text)).toEqual(['remember']);
    expect(read.lines.filter((l) => !l.deviceNote)).toHaveLength(2);
    expect(wordCount(read.lines)).toBe(body.length + note.length);
  });

  it('keeps a printed option that one handwritten word joins as printed, not a note', () => {
    // Short words beside body text are kept on its line as fallback-font labels ("Fien" is 4).
    const option = row('A. Coarctation of the Aorta', 36, 100, 'ABCDEF+TimesNewRomanPSMT');
    const ink = row('Fien', 205, 100, '.SFUI-Regular');
    const read = linesOf(fileUnits([]), [page([...option, ...ink])]);
    const printed = read.lines.filter((l) => l.text.startsWith('A. Coarctation'));
    expect(printed.map((l) => [l.text, l.deviceNote])).toEqual([
      ['A. Coarctation of the Aorta', false],
    ]);
    expect(read.lines.filter((l) => l.deviceNote).map((l) => l.text)).toEqual(['Fien']);
    expect(wordCount(read.lines)).toBe(option.length + ink.length);
  });

  it('reads a scanned page as OCR lines with no word lost', () => {
    const words = [...row('12. A boy has a cough', 36, 100), ...row('A. asthma', 36, 114)];
    const read = linesOf(fileUnits([], true), [page(words)]);
    expect(read.lines.map((l) => l.source)).toEqual(['ocr', 'ocr']);
    expect(wordCount(read.lines)).toBe(words.length);
  });
});

describe('the layout measured in step 2 (M39)', () => {
  it('measures the layout from the file own lines', () => {
    const ys = [100, 114, 128, 158, 172, 202];
    const words = ys.flatMap((y, i) => row(`line number ${i}`, 36, y));
    const { layout } = linesOf(fileUnits([]), [page(words)]);
    expect(layout.lineHeight).toBe(10);
    expect(layout.lineGap).toBe(4);
    expect(layout.paragraphGap).toBe(20);
    expect([...layout.margins]).toEqual([[1, 36]]);
  });

  it('measures a right-to-left page margin at its right edge', () => {
    const words = [100, 114, 128].flatMap((y) => row('سؤال عن الدواء', 400, y));
    const { layout, lines } = linesOf(fileUnits([]), [page(words)]);
    expect(lines.every((l) => l.rtl)).toBe(true);
    expect(layout.margins.get(1)).toBe(Math.round(lines[0]?.box.x1 ?? 0));
  });
});
