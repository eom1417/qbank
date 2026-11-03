import { describe, expect, it } from 'vitest';
import { parseTesseractTsv } from '../../../src/server/capabilities/sources/adapters/readers.js';
import { parseStext } from '../../../src/server/capabilities/sources/adapters/stext.js';
import {
  bodyFontFamily,
  pageLines,
} from '../../../src/server/capabilities/sources/domain/lines.js';
import { fontFamily } from '../../../src/server/capabilities/sources/domain/page.js';
import { repairWithOcr } from '../../../src/server/capabilities/sources/domain/repair.js';

const char = (c: string, x: number, font = 'AAAAAF+TimesNewRomanPSMT') =>
  `<font name="${font}"><char quad="${x} 10 ${x + 5} 10 ${x} 22 ${x + 5} 22" c="${c}"/></font>`;

describe('text layer and OCR readers', () => {
  it('parses MuPDF structured text into words with fonts', () => {
    const xml = `<page width="612" height="792"><line>${char('Q', 10)}${char('1', 15)}${char(' ', 20)}${char('&amp;', 25)}${char('n', 40, '.SFUI-Regular')}</line></page>`;
    const [page] = parseStext(xml);
    expect(page?.words.map((w) => [w.text, w.font])).toEqual([
      ['Q1', 'AAAAAF+TimesNewRomanPSMT'],
      ['&n', 'AAAAAF+TimesNewRomanPSMT'],
    ]);
    expect(page?.words[0]?.box).toEqual({ x0: 10, y0: 10, x1: 20, y1: 22 });
  });

  it('parses Tesseract TSV words into PDF points', () => {
    const tsv =
      'level\tp\tb\tpar\tl\tw\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t200\t100\t50\t25\t96\tHello\n4\t1\t1\t1\t1\t0\t0\t0\t0\t0\t-1\t\n';
    expect(parseTesseractTsv(tsv, 144)).toEqual([
      { text: 'Hello', box: { x0: 100, y0: 50, x1: 125, y1: 62.5 }, font: null, line: '1.1.1' },
    ]);
  });
});

describe('fonts and OCR repair', () => {
  it('treats bold and regular as one family and leaves device handwriting out', () => {
    expect(fontFamily('AAAAAF+TimesNewRomanPS-BoldMT')).toBe(fontFamily('TimesNewRomanPSMT'));
    const word = (text: string, x: number, font: string) => ({
      text,
      box: { x0: x, y0: 0, x1: x + 20, y1: 10 },
      font,
    });
    const page = {
      page: 1,
      width: 600,
      height: 800,
      words: [
        word('Typed', 0, 'TimesNewRomanPSMT'),
        word('words', 30, 'TimesNewRomanPS-BoldMT'),
        word('ink', 60, '.SFUI-Regular'),
      ],
    };
    expect(bodyFontFamily([page])).toBe('TimesNewRoman');
    expect(pageLines(page, 'TimesNewRoman').map((l) => l.text)).toEqual(['Typed words']);
  });

  it('replaces unreadable text-layer words with OCR words on the same line', () => {
    const word = (text: string, x: number) => ({
      text,
      box: { x0: x, y0: 0, x1: x + 20, y1: 10 },
      font: 'Times',
    });
    const page = { page: 1, width: 600, height: 800, words: [word('B.', 0), word('��', 30)] };
    const ocr = {
      ...page,
      words: [
        { ...word('B.', 0), font: null },
        { ...word('Pulmonary', 30), font: null },
      ],
    };
    expect(repairWithOcr(page, ocr).words.map((w) => w.text)).toEqual(['B.', 'Pulmonary']);
  });
});
