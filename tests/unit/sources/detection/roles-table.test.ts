import { expect, it } from 'vitest';
import type {
  FileLines,
  Line,
} from '../../../../src/server/capabilities/sources/detection/contract.js';
import { classifyLines } from '../../../../src/server/capabilities/sources/detection/roles/classify-lines.js';

function tableLine(text: string, id: number): Line {
  const top = 58.74 + id * 24.75;
  let left = id === 0 || id === 5 ? 57 : 63;
  const words = text.split(' ').map((word, index) => {
    const box = { x0: left, y0: top, x1: left + word.length * 7, y1: top + 11.73 };
    left = box.x1 + (id > 0 && id < 5 && index === 0 ? 9.59 : 2.92);
    return { text: word, box, font: null };
  });
  const first = words[0];
  const last = words.at(-1);
  if (!first || !last) throw new Error('The table row needs text');
  return {
    id,
    page: 1,
    text,
    words,
    unitId: `table-${id}`,
    source: 'text',
    box: { ...first.box, x1: last.box.x1 },
    rtl: false,
    confidence: null,
    deviceNote: false,
  };
}

it('uses the row own word spacing to read compact table option cells', () => {
  const lines = [
    'Q1) Match the vitamin deficiency in the table below?',
    'A Vitamin C scurvy',
    'B Vitamin D rickets',
    'C Vitamin A night blindness',
    'D Vitamin K bleeding',
    'Answer: B',
  ].map(tableLine);
  const layout = {
    lineHeight: 11.73,
    lineGap: 13.02,
    paragraphGap: 24.75,
    margins: new Map([[1, 57]]),
  };
  const file: FileLines = {
    lines,
    layout,
    units: new Map() as never,
    pages: [{ page: 1, width: 612, height: 792, words: [] }],
  };
  expect(classifyLines(file).map(({ role, letter }) => letter ?? role)).toEqual([
    'label',
    'A',
    'B',
    'C',
    'D',
    'answer',
  ]);
});
