import { describe, expect, it } from 'vitest';
import { classifyLines } from '../../../../src/server/capabilities/sources/detection/roles/classify-lines.js';
import { at, fileOf } from '../../../support/detection-lines.js';

describe('a line with no letter or digit (M39 step 3)', () => {
  it('is filler, so a stray bracket or comma never joins the option above', () => {
    const roles = classifyLines(
      fileOf([
        at('1. Which drug?', 100),
        at('A. aspirin', 114),
        at('B. heparin', 128),
        at(']', 175),
      ]),
    );
    expect(roles.map((role) => role.role)).toEqual(['label', 'option', 'option', 'filler']);
  });
});

describe('a table header the page repeats above each option row (M39 step 3)', () => {
  it('is filler, not more of the option above it', () => {
    const header = 'Response Choice T4 TSH';
    const roles = classifyLines(
      fileOf([
        at('3. Which results fit?', 100),
        at(header, 114),
        at('A. 7.0 9.2 Normal', 128),
        at(header, 142),
        at('B. 4.2 48 Low', 156),
      ]),
    );
    expect(roles.map((role) => role.role)).toEqual(['label', 'stem', 'option', 'filler', 'option']);
  });
});
