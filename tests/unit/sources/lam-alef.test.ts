import { describe, expect, it } from 'vitest';
import { toLogical } from '../../../src/server/capabilities/sources/domain/bidi.js';

// A PDF printed with a font whose lam-alef ligature is one glyph (seen on GitHub's CI, M24/M26):
// MuPDF gives the ligature as one presentation-form character, in visual order. Decomposing it
// before turning the word around swapped its letters: «الأول» came out «األول».
describe('lam-alef ligatures in a PDF text layer', () => {
  it.each([
    ['لوﻷا', 'الأول'],
    ['جﻼﻋ', 'علاج'],
    ['لﺎﻔﻃﻷا', 'الأطفال'],
    ['ﻻ', 'لا'],
    ['ﻦﻳﺮﺒﺳﻷا', 'الأسبرين'],
  ])('reads %s as %s', (visual, logical) => {
    expect(toLogical(visual)).toBe(logical);
  });
});
