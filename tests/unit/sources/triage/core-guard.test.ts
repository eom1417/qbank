import { describe, expect, it } from 'vitest';
import {
  keepsCore,
  onlyPrintedWords,
} from '../../../../src/server/capabilities/sources/domain/triage/core-guard.js';

describe('the core of a question survives a rewrite (DEC-34)', () => {
  const stem = 'All of the following cause miosis EXCEPT: (dose 0.5 mg/kg)';

  it('accepts clearer words around the same numbers and meaning', () => {
    expect(keepsCore(stem, 'Which of these does NOT cause miosis? Except at 0.5 mg/kg doses')).toBe(
      true,
    );
    expect(keepsCore(stem, 'Each of these causes miosis except one (dose 0,5 mg/kg).')).toBe(true);
  });

  it('refuses a rewrite that drops a number or the word that turns the question', () => {
    expect(keepsCore(stem, 'All of the following cause miosis (dose 5 mg/kg)')).toBe(false);
    expect(keepsCore(stem, 'Which of the following causes miosis? (dose 0.5 mg/kg)')).toBe(false);
    expect(keepsCore('أي مما يلي ليس من أعراض نقص السكر؟', 'أي مما يلي من أعراض نقص السكر؟')).toBe(
      false,
    );
  });

  it('lets organizing cut and reorder printed words, but not write new ones', () => {
    const page =
      '/61 A 13-year-old has recurrent infections. Which is most likely? 927. Answer (a)';
    expect(
      onlyPrintedWords(page, 'A 13-year-old has recurrent infections. Which is most likely?'),
    ).toBe(true);
    expect(
      onlyPrintedWords(
        page,
        'A teenager presents with frequent bacterial illnesses; what is the diagnosis?',
      ),
    ).toBe(false);
  });
});
