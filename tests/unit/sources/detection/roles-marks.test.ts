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

describe('a picture after the stem has asked its question (M39 step 3)', () => {
  it('is the figure the question shows, not more of its stem', () => {
    const roles = classifyLines(
      fileOf([
        at('14. His blood pressure is high. What is your management?', 100),
        at('Acute severe elevation of BP confirmed', 130, { picture: 'flowchart' }),
        at('Support airway and breathing', 144, { picture: 'flowchart' }),
        at('A. Labetalol', 180),
        at('B. Nifedipine', 194),
      ]),
    );
    expect(roles.map((role) => role.role)).toEqual([
      'label',
      'filler',
      'filler',
      'option',
      'option',
    ]);
  });

  it('reads a table picture after a stem ending in a full stop as its figure', () => {
    const roles = classifyLines(
      fileOf([
        at('10. A study was done on newborns. Calculate the specificity.', 100),
        at('Positive Predictive Value', 130, { picture: 'table' }),
        at('A. 80%', 170),
        at('B. 90%', 184),
      ]),
    );
    expect(roles[1]?.role).toBe('filler');
  });

  it('keeps a picture that carries on a stem still asking', () => {
    const roles = classifyLines(
      fileOf([
        at('15. A boy has a rash on his', 100),
        at('arms. Which drug is best?', 114, { picture: 'shot' }),
        at('A. Aspirin', 140),
        at('B. Heparin', 154),
      ]),
    );
    expect(roles[1]?.role).toBe('stem');
  });
});

describe('a first option whose letter a pen circle hid from OCR (M39 step 3)', () => {
  it('is option A when "B." follows starting where it starts', () => {
    const roles = classifyLines(
      fileOf([
        at('2. What is the most likely cause of this lesion?', 100),
        at('(. Aortic stenosis', 114),
        at('B. Pulmonary stenosis', 128),
      ]),
    );
    expect(roles.map((role) => [role.role, role.letter])).toEqual([
      ['label', undefined],
      ['option', 'A'],
      ['option', 'B'],
    ]);
  });

  it('leaves the stem whole when its last line asks the question', () => {
    const roles = classifyLines(
      fileOf([
        at('2. A boy has a murmur at the left', 100),
        at('sternal border. What is the cause?', 114),
        at('B. Pulmonary stenosis', 128),
      ]),
    );
    expect(roles[1]?.role).toBe('stem');
  });
});

describe('a letter circled by hand, as OCR reads it (M39 step 3)', () => {
  it.each([
    ['its circle read as "("', '(A. Gordon syndrome'],
    ['read as a symbol', '@)Tricuspid atresia'],
  ])('is the next option, marked as circled: %s', (_form, option) => {
    const roles = classifyLines(
      fileOf([at('6. What is the most likely cause?', 100), at(option, 114), at('B. Other', 128)]),
    );
    expect(roles.map((role) => [role.role, role.letter, role.circled])).toEqual([
      ['label', undefined, undefined],
      ['option', 'A', true],
      ['option', 'B', undefined],
    ]);
  });
});

describe('a numbered list inside a question (M39 step 3)', () => {
  it('does not restart the numbering: "1." under question 40 is not a question', () => {
    const roles = classifyLines(
      fileOf([
        at('40. What is the next step?', 100),
        at('A. Reassurance', 114),
        at('B. Repeat urine culture', 128),
        at('1. Nitrite test:', 142),
        at('a. Detects products of reduction', 156),
        at('b. False negatives occur', 170),
      ]),
    );
    expect(roles.filter((role) => role.role === 'label').map((role) => role.number)).toEqual([40]);
  });
});

describe('a question pasted in a screenshot under a typed one (M39 step 3)', () => {
  it('stays an excerpt even when its options are read outside the picture', () => {
    const roles = classifyLines(
      fileOf([
        at('49. What is your next step?', 100),
        at('A. Reassurance', 114),
        at('B. Surgery', 128),
        at('Q213) Which abnormality is common in prune belly?', 170, { picture: 'shot' }),
        at('A. Cryptorchidism', 184),
        at('B. Hypospadias', 198),
      ]),
    );
    expect(roles.filter((role) => role.role === 'label').map((role) => role.number)).toEqual([49]);
  });
});

describe('a circled letter OCR read as a digit in brackets (M39 step 3)', () => {
  it('is the next option, circled', () => {
    const roles = classifyLines(
      fileOf([
        at('36. Which is correct?', 100),
        at('A. Intussusception', 114),
        at('B. Thrombocytopenia', 128),
        at('C. Low IgA', 142),
        at('(8) skin biopsy will confirm vasculitis', 156),
      ]),
    );
    expect(roles[4]).toMatchObject({ role: 'option', letter: 'D', circled: true });
  });
});
