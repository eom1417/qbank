import { describe, expect, it } from 'vitest';
import {
  orderPage,
  type UnitDraft,
} from '../../../src/server/capabilities/sources/domain/pipeline/units.js';

const size = { page: 2, width: 600, height: 800 };
const draft = (text: string, x0: number, y0: number, x1: number, over: Partial<UnitDraft> = {}) =>
  ({
    page: 2,
    box: { x0, y0, x1, y1: y0 + 10 },
    kind: 'text_line',
    text,
    ocr: null,
    imageClass: null,
    fingerprint: null,
    filler: null,
    source: 'text_layer',
    ...over,
  }) satisfies UnitDraft;

const texts = (drafts: UnitDraft[]) => orderPage(size, drafts).map((unit) => unit.text);

describe('unit reading order (M34 D1.1)', () => {
  it('reads columns left then right, top to bottom, with ids and order', () => {
    const left = Array.from({ length: 8 }, (_, i) => draft(`L${i}`, 40, 100 + i * 20, 260));
    const right = Array.from({ length: 8 }, (_, i) => draft(`R${i}`, 320, 100 + i * 20, 560));
    const picture = draft('', 320, 125, 560, { kind: 'image', source: 'image' });
    const units = orderPage(size, [...right, picture, ...left].reverse());
    expect(units.map((unit) => unit.text)).toEqual([
      ...left.map((unit) => unit.text),
      'R0',
      'R1',
      '',
      ...right.slice(2).map((unit) => unit.text),
    ]);
    expect(units[0]).toMatchObject({ id: 'p2-u0', order: 0 });
  });

  it('puts a title across both columns first, and a wide picture under them last', () => {
    const left = Array.from({ length: 8 }, (_, i) => draft(`L${i}`, 40, 100 + i * 20, 260));
    const right = Array.from({ length: 8 }, (_, i) => draft(`R${i}`, 320, 100 + i * 20, 560));
    const title = draft('Title', 200, 60, 400);
    const wide = draft('', 100, 400, 500, { kind: 'image', source: 'image' });
    const order = texts([wide, ...right, ...left, title]);
    expect(order[0]).toBe('Title');
    expect(order[order.length - 1]).toBe('');
  });

  it('reads Arabic pages right to left across a row', () => {
    const lines = [draft('سؤال أول', 300, 50, 560), draft('أ. خيار', 400, 70, 560)];
    const leftPicture = draft('', 60, 100, 250, { kind: 'image', source: 'image' });
    const rightPicture = draft('', 320, 100, 560, { kind: 'image', source: 'image' });
    const units = orderPage(size, [leftPicture, rightPicture, ...lines]);
    expect(units.map((unit) => unit.box.x0)).toEqual([300, 400, 320, 60]);
  });

  it('keeps filler after the content, top to bottom', () => {
    const footer = draft('page 2', 280, 780, 320, { kind: 'filler', filler: 'running_line' });
    const logo = draft('', 20, 10, 60, { kind: 'filler', filler: 'repeated', source: 'image' });
    expect(texts([footer, draft('Q1) Text', 40, 100, 300), logo])).toEqual([
      'Q1) Text',
      '',
      'page 2',
    ]);
  });
});
