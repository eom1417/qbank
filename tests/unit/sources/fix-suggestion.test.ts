import { describe, expect, it } from 'vitest';
import { refusalOf } from '../../../src/server/capabilities/sources/domain/fix-suggestion.js';

const current = {
  stem: 'A patient has a serum potassium of 7.2 rnmol/L. Which ECG change is typical?',
  options: [
    { letter: 'A', text: 'Peaked T waves' },
    { letter: 'B', text: 'U waves' },
  ],
};
const PAGE =
  'A patient has a serum potassium of 7.2 mmol/L. Which ECG change is typical? A. Peaked T waves B. U waves';

const suggestion = (changes: object) => ({
  ...current,
  stem: current.stem.replace('rnmol', 'mmol'),
  reason: 'The unit was misread.',
  evidence: '7.2 mmol/L',
  ...changes,
});

describe('checking an AI fix suggestion (FR-09-005, FR-08-014, FR-24-005)', () => {
  it('accepts a reading fix whose evidence is on the page (a measurement error, before and after)', () => {
    expect(refusalOf(current, suggestion({}), PAGE)).toBeNull();
  });

  it('refuses evidence that is not on the page: no unsupported inference', () => {
    expect(refusalOf(current, suggestion({ evidence: '7.2 mEq/L in most labs' }), PAGE)).toBe(
      'unsupported',
    );
    expect(refusalOf(current, suggestion({ evidence: '' }), PAGE)).toBe('unsupported');
  });

  it('refuses padding, a changed option list, and a suggestion that changes nothing', () => {
    const longer = `${current.stem} Consider also the patient's renal function, medications and recent dietary intake in detail.`;
    expect(refusalOf(current, suggestion({ stem: longer }), PAGE)).toBe('padding');
    const extra = [...current.options, { letter: 'C', text: 'Delta waves' }];
    expect(refusalOf(current, suggestion({ options: extra }), PAGE)).toBe('changed_options');
    expect(refusalOf(current, { ...current, reason: '', evidence: '7.2' }, PAGE)).toBe('no_change');
  });
});
