import { describe, expect, it } from 'vitest';
import { bodyFontFamilies } from '../../../src/server/capabilities/sources/domain/lines.js';
import type { PageText } from '../../../src/server/capabilities/sources/domain/page.js';

// M36: a bank book sets its questions, tables and long explanations in several fonts (PREP:
// Calibri questions, Times tables, Helvetica explanations). With no device note font in the
// file nothing is a note and every word is kept; a file written on keeps leaving its notes out.
const word = (text: string, x0: number, y0: number, font: string) => ({
  text,
  box: { x0, y0, x1: x0 + 40, y1: y0 + 10 },
  font,
});

const explanation = (y0: number, font: string) =>
  Array.from({ length: 12 }, (_, i) => word('explanation', 20 + i * 45, y0, font));

function bookPage(labelFont: string, labelledLines: number): PageText {
  const words = [];
  let y = 0;
  for (let i = 0; i < 40; i++) words.push(...explanation((y += 15), 'Helvetica'));
  for (let i = 1; i <= labelledLines; i++) {
    words.push(word(`Question:`, 20, (y += 15), labelFont), word(`${i}`, 65, y, labelFont));
    words.push(
      word('A.first', 20, (y += 15), labelFont),
      word('B.second', 20, (y += 15), labelFont),
    );
  }
  return { page: 1, width: 600, height: 4000, visual: true, words };
}

describe('body fonts of a bank book (M36)', () => {
  it('keeps every font of a book nobody wrote on', () => {
    expect(bodyFontFamilies([bookPage('Calibri', 4)])).toBeNull();
  });

  it('still leaves out the note font of a file written on', () => {
    const page = bookPage('Calibri', 4);
    page.words.push(word('A.note', 300, 5000, '.SFUI-Regular'), ...explanation(5020, '.SFUI'));
    expect(bodyFontFamilies([page])).toEqual(new Set(['Helvetica']));
  });
});
