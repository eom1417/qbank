import { describe, expect, it } from 'vitest';
import { classifyLines } from '../../../../src/server/capabilities/sources/detection/roles/classify-lines.js';
import { at, fileOf } from '../../../support/detection-lines.js';

describe('a line with no letter or digit (M39 step 3)', () => {
  it('is filler, so a stray bracket or comma never joins the option above', () => {
    const roles = classifyLines(
      fileOf([at('1. Which drug?', 100), at('A. aspirin', 114), at('B. heparin', 128), at(']', 175)]),
    );
    expect(roles.map((role) => role.role)).toEqual(['label', 'option', 'option', 'filler']);
  });
});
