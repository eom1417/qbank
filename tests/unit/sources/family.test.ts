import { describe, expect, it } from 'vitest';
import {
  documentFamily,
  FAMILY_LESSONS,
  familyOf,
  type FamilySignals,
} from '../../../src/server/capabilities/sources/domain/pipeline/family.js';
import type { Unit } from '../../../src/server/capabilities/sources/domain/pipeline/units.js';

const signals = (over: Partial<FamilySignals>): FamilySignals => ({
  pages: 10,
  textLayerShare: 1,
  scanPageShare: 0,
  imageAreaShare: 0.05,
  inkPageShare: 0,
  questionLines: 40,
  optionLines: 160,
  inlineKeyLines: 0,
  keyTableLines: 0,
  explanationLines: 0,
  ...over,
});

const line = (page: number, text: string, over: Partial<Unit> = {}): Unit => ({
  id: `p${page}-u0`,
  page,
  box: { x0: 0, y0: 0, x1: 100, y1: 10 },
  kind: 'text_line',
  text,
  ocr: null,
  imageClass: null,
  fingerprint: null,
  order: 0,
  filler: null,
  source: 'text_layer',
  ...over,
});

describe('document family (M34 D0.1)', () => {
  it('sorts files by code signals', () => {
    expect(documentFamily(signals({ textLayerShare: 0.2, scanPageShare: 0.8 }))).toBe('scan');
    expect(documentFamily(signals({ inkPageShare: 0.6 }))).toBe('annotated_notes');
    // Notes built of pasted screenshots: no text layer, but device ink on every page.
    expect(documentFamily(signals({ textLayerShare: 0.1, inkPageShare: 1 }))).toBe(
      'annotated_notes',
    );
    expect(documentFamily(signals({ keyTableLines: 6 }))).toBe('printed_key');
    expect(documentFamily(signals({ inlineKeyLines: 38 }))).toBe('printed_key');
    expect(documentFamily(signals({ inlineKeyLines: 38, explanationLines: 36 }))).toBe(
      'exported_bank',
    );
    expect(documentFamily(signals({}))).toBe('exam_paper');
    expect(documentFamily(signals({ questionLines: 0, optionLines: 0 }))).toBe('other');
    expect(documentFamily(signals({ pages: 0 }))).toBe('other');
  });

  it('runs no hand-mark lesson on a printed key, and none at all on a new shape', () => {
    expect(FAMILY_LESSONS.printed_key).not.toContain('D4.3');
    expect(FAMILY_LESSONS.annotated_notes).toContain('D4.3');
    expect(FAMILY_LESSONS.other).toEqual([]);
  });

  it('reads the signals from units', () => {
    const sizes = [1, 2].map((page) => ({ page, width: 100, height: 100 }));
    const units = [
      line(1, 'Q1) Which is first?'),
      line(1, 'A. One'),
      line(1, 'Correct answer: A'),
      line(2, 'Explanation: because'),
      line(2, '', { kind: 'filler', filler: 'ink_overlay', source: 'image' }),
    ];
    const verdict = familyOf(sizes, units);
    expect(verdict.signals).toMatchObject({
      pages: 2,
      textLayerShare: 1,
      inkPageShare: 0.5,
      questionLines: 1,
      optionLines: 1,
      inlineKeyLines: 1,
      explanationLines: 1,
    });
    expect(verdict.family).toBe('annotated_notes');
  });
});
