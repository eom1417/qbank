import { describe, expect, it } from 'vitest';
import {
  boxOn,
  optionsAndKey,
  PageReply,
  snapToRegion,
  textHint,
} from '../../../src/server/capabilities/sources/domain/page-reading.js';

const page = {
  page: 2,
  width: 600,
  height: 800,
  words: [{ text: 'Hello', box: { x0: 0, y0: 0, x1: 1, y1: 1 }, font: null }],
};
const figure = { kind: 'figure' as const, x: 0.1, y: 0.25, width: 0.5, height: 0.25 };

describe("reading a page with the user's AI: what its reply may become", () => {
  it('turns fractions into page points, kept inside the page, and drops specks', () => {
    expect(boxOn(page, figure)).toEqual({ x0: 60, y0: 200, x1: 360, y1: 400 });
    expect(boxOn(page, { ...figure, x: 0.9, width: 0.5 })?.x1).toBe(600);
    expect(boxOn(page, { ...figure, width: 0.01 })).toBeNull();
  });

  it('keys only answers that name a real option, by its printed label', () => {
    const read = {
      number: 1,
      stem: 'Q',
      options: [
        { label: 'أ', text: 'one' },
        { label: 'ب', text: 'two' },
      ],
      answers: ['ب', 'ب', 'Z'],
      explanation: null,
      figures: [],
    };
    expect(optionsAndKey(read)).toEqual({
      options: [
        { letter: 'A', label: 'أ', text: 'one' },
        { letter: 'B', label: 'ب', text: 'two' },
      ],
      answers: ['B'],
    });
  });

  it('takes the exact edges of a picture the rules found, else keeps its own box', () => {
    const found = [
      { page: 2, box: { x0: 58, y0: 210, x1: 350, y1: 395 }, kind: 'figure' as const, ppi: 150 },
      { page: 3, box: { x0: 60, y0: 200, x1: 360, y1: 400 }, kind: 'figure' as const, ppi: 150 },
    ];
    const box = boxOn(page, figure);
    expect(box && snapToRegion(2, box, found)).toBe(found[0]);
    expect(box && snapToRegion(2, box, found.slice(1))).toBeNull();
  });

  it('refuses a reply that does not match the schema, and hides words in visual order', () => {
    expect(PageReply.safeParse({ questions: [{ number: 0, stem: '' }] }).success).toBe(false);
    expect(textHint(page)).toBe('Hello');
    expect(textHint({ ...page, visual: true })).toBeNull();
  });
});
