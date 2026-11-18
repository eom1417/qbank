import { describe, expect, it } from 'vitest';
import type {
  Doubt,
  FileLines,
  Line,
  LineRole,
  LineSource,
} from '../../../../src/server/capabilities/sources/detection/contract.js';
import { assistDoubts } from '../../../../src/server/capabilities/sources/detection/assist/assist-doubts.js';
import { regionOf } from '../../../../src/server/capabilities/sources/detection/assist/regions.js';
import { modelFor } from '../../../../src/server/capabilities/sources/domain/pipeline/approved-models.js';
import { LIGHT, NOW, lessonWorld, recorded, textOf } from '../../../support/lesson-world.js';

// M39 step 6: the AI points at line ids and roles; only an OCR line's spelling may be fixed.

const line = (id: number, text: string, source: LineSource = 'text'): Line => ({
  id,
  page: 1,
  box: { x0: 0, y0: id * 10, x1: 100, y1: id * 10 + 8 },
  text,
  words: [],
  source,
  unitId: `u${id}`,
  rtl: false,
  confidence: source === 'text' ? null : 70,
  deviceNote: false,
});
const fileOf = (lines: Line[]): FileLines =>
  ({ lines, units: { pages: [] }, pages: [], layout: {} }) as unknown as FileLines;
const rule = (id: number, role: LineRole['role'], confidence = 0.8): LineRole => ({
  line: id,
  role,
  confidence,
});
const doubt = (lines: number[], question = 0): Doubt => ({
  check: 'stem',
  question,
  lines,
  detail: 'synthetic doubt',
});
const answer = (id: number, role: string, extra: Record<string, unknown> = {}) => ({
  id,
  role,
  number: null,
  letter: null,
  text: null,
  ...extra,
});

const FILE = fileOf([
  line(0, '1.'),
  line(1, 'Wh1ch synthet1c drug is first?', 'ocr'),
  line(2, 'A. Drug one'),
  line(3, 'B. Drug two'),
  line(4, '2.'),
  line(5, 'Another synthetic stem'),
]);
const ROLES = [
  rule(0, 'label'),
  rule(1, 'unknown', 0.3),
  rule(2, 'stem', 0.4),
  rule(3, 'option'),
  rule(4, 'label'),
  rule(5, 'stem'),
];

async function assistOnce(lines: ReturnType<typeof answer>[]) {
  const world = lessonWorld({ [LIGHT]: [recorded({ items: [{ n: 1, lines }] })] });
  const progress: [number, number][] = [];
  const result = await assistDoubts(
    world.deps,
    'synthetic.pdf',
    FILE,
    ROLES,
    [doubt([1, 2])],
    (d, t) => {
      progress.push([d, t]);
      return Promise.resolve();
    },
  );
  return { ...world, result, progress };
}

describe('assist: the region of a doubt (M39 step 6)', () => {
  it('runs from the label before the doubt to the label after it', () => {
    expect(regionOf(doubt([1, 2]), ROLES, 6)).toEqual([0, 1, 2, 3, 4]);
    expect(regionOf(doubt([5]), ROLES, 6)).toEqual([4, 5]);
    expect(regionOf(doubt([]), ROLES, 6)).toEqual([]);
  });

  it('is approved for the same models as D6.1', () => {
    expect(modelFor('D3.roles', 'claude', 'light')).toBe(modelFor('D6.1', 'claude', 'light'));
  });
});

describe('assist: accepting the model answer (M39 step 6)', () => {
  it('replaces the rule roles with the model roles and shows ids with OCR marks', async () => {
    const { result, calls, progress } = await assistOnce([
      answer(1, 'stem'),
      answer(2, 'option', { letter: 'a' }),
      answer(3, 'bogus'),
      answer(99, 'stem'),
    ]);
    expect(result.roles[1]).toEqual({ line: 1, role: 'stem', confidence: 0.9, byModel: true });
    expect(result.roles[2]).toEqual({
      line: 2,
      role: 'option',
      letter: 'A',
      confidence: 0.9,
      byModel: true,
    });
    expect(result.roles[3]).toEqual(ROLES[3]);
    expect(result.roles).toHaveLength(6);
    expect(result.failure).toBeNull();
    expect(result.usage).toMatchObject([{ lesson: 'D3.roles', model: LIGHT }]);
    expect(progress).toEqual([[1, 1]]);
    expect(textOf(calls, 0)).toContain('1 [ocr]: Wh1ch synthet1c drug is first?');
    expect(textOf(calls, 0)).toContain('2: A. Drug one');
  });

  it('accepts an OCR spelling fix but never text on a text-layer line', async () => {
    const { result } = await assistOnce([
      answer(1, 'stem', { text: 'Which synthetic drug is first?' }),
      answer(2, 'option', { letter: 'A', text: 'A. Drug one' + ' is the best choice' }),
      answer(3, 'option', { letter: 'B', text: 'B. Drug two' }),
    ]);
    expect([...result.corrections]).toEqual([[1, 'Which synthetic drug is first?']]);
  });

  it('rejects a large rewrite of an OCR line but keeps its role', async () => {
    const { result } = await assistOnce([
      answer(1, 'stem', { text: 'Name the kidney hormone released in shock' }),
    ]);
    expect(result.corrections.size).toBe(0);
    expect(result.roles[1]).toMatchObject({ role: 'stem', byModel: true });
  });
});

describe('assist: a lesson failure stops the step (M39 step 6)', () => {
  it('returns the regions done so far with the failure and when to resume', async () => {
    const lines = Array.from({ length: 11 }, (_, q) => [
      line(2 * q, `${q + 1}.`),
      line(2 * q + 1, 'Wh1ch drug', 'ocr'),
    ]).flat();
    const roles = lines.map((l) => rule(l.id, l.id % 2 === 0 ? 'label' : 'unknown', 0.3));
    const doubts = Array.from({ length: 11 }, (_, q) => doubt([2 * q + 1], q));
    const items = Array.from({ length: 10 }, (_, q) => ({
      n: q + 1,
      lines: [answer(2 * q + 1, 'stem', { text: 'Which drug' })],
    }));
    const world = lessonWorld({
      [LIGHT]: [recorded({ items }), { ok: false, failure: 'no_quota' }],
    });
    const progress: number[] = [];
    const result = await assistDoubts(world.deps, 'f.pdf', fileOf(lines), roles, doubts, (d) => {
      progress.push(d);
      return Promise.resolve();
    });
    expect(result.failure).toBe('no_quota');
    expect(result.resumeAfter).toEqual(new Date(NOW.getTime() + 60 * 60_000));
    expect(result.roles[19]).toMatchObject({ role: 'stem', byModel: true });
    expect(result.roles[21]).toEqual(roles[21]);
    expect(result.corrections.size).toBe(10);
    expect(progress).toEqual([10]);
  });
});

it('keeps the actual doubtful line inside a capped region far from its preceding label', () => {
  const region = regionOf(doubt([110]), [rule(0, 'label'), rule(129, 'label')], 130);
  expect(region).toContain(110);
  expect(region.length).toBeLessThanOrEqual(60);
});

it('shows every line of a long unknown run instead of silently dropping the tail', async () => {
  const lines = Array.from({ length: 130 }, (_, id) => line(id, `Source row ${id}`));
  const replies = [0, 60, 120].map((id, at) => ({ n: at + 1, lines: [answer(id, 'stem')] }));
  const world = lessonWorld({ [LIGHT]: [recorded({ items: replies })] });
  await assistDoubts(
    world.deps,
    'sample.pdf',
    fileOf(lines),
    lines.map((l) => rule(l.id, 'unknown')),
    [doubt(lines.map((l) => l.id))],
    async () => {},
  );
  const prompt = textOf(world.calls, 0);
  for (const id of [0, 59, 60, 119, 120, 129]) expect(prompt).toContain(`${id}: Source row ${id}`);
});
