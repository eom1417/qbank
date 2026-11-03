import { describe, expect, it } from 'vitest';
import { toLogical } from '../../../src/server/capabilities/sources/domain/bidi.js';
import {
  optionLabel,
  questionLabel,
} from '../../../src/server/capabilities/sources/domain/labels.js';
import {
  bodyFontFamilies,
  pageLines,
} from '../../../src/server/capabilities/sources/domain/lines.js';

const word = (text: string, x0: number, x1: number, font: string, y0 = 0) => ({
  text,
  box: { x0, y0, x1, y1: y0 + 10 },
  font,
});

describe('documents in two scripts (UAT-009)', () => {
  it('keeps each script in its own body font, still leaving a stray note out', () => {
    const page = {
      page: 1,
      width: 600,
      height: 800,
      visual: true,
      words: [
        word('ﺎﻣ', 340, 360, 'NotoNaskhArabic-Regular'),
        word('ءاوﺪﻟا', 300, 335, 'NotoNaskhArabic-Regular'),
        word('HbA1c', 250, 295, 'LiberationSerif'),
        word('IM', 180, 195, 'LiberationSerif', 40),
        word('Adrenaline', 100, 175, 'LiberationSerif', 40),
        word('ok', 10, 30, '.SFUI-Regular', 80),
      ],
    };
    expect(bodyFontFamilies([page])).toEqual(new Set(['NotoNaskhArabic', 'LiberationSerif']));
    expect(pageLines(page, bodyFontFamilies([page])).map((line) => line.text)).toEqual([
      'ما الدواء HbA1c',
      'Adrenaline IM',
    ]);
  });

  it('keeps a percent or degree sign on its number', () => {
    expect(toLogical('9%و')).toBe('و9%');
    expect(toLogical('37°C')).toBe('37°C');
    expect(toLogical('(1س')).toBe('س1)');
  });
});

describe('faithful text (FR-05-011)', () => {
  it('keeps Arabic-Indic digits in the question text, numbering read either way', () => {
    expect(questionLabel('س٢) طفل عمره ٦ أشهر')).toEqual({
      number: 2,
      text: 'طفل عمره ٦ أشهر',
      prefixed: true,
    });
    expect(optionLabel('ب) ٥ ملغ')?.text).toBe('٥ ملغ');
  });
});
