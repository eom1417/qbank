import { describe, expect, it } from 'vitest';
import type { Leftover } from '../../../src/server/capabilities/sources/domain/pipeline/leftover.js';
import {
  insertAfter,
  withStructure,
} from '../../../src/server/capabilities/sources/use-cases/pipeline-structure.js';
import {
  LIGHT,
  lessonWorld,
  pipelineQuestion,
  recorded,
  STRONG,
} from '../../support/lesson-world.js';

// M34 P4b: D6.1 over leftover pictures on RECORDED replies: what is asked, built and placed.

const BOX = { x0: 0, y0: 0, x1: 200, y1: 80 };
const picture = (unitId: string, texts: string[], before: string | null): Leftover => ({
  unitId,
  page: 3,
  box: BOX,
  lines: texts.map((text, i) => ({ n: i + 1, text, box: BOX })),
  before,
});
const QUESTION = ['7) Which synthetic sign fits?', 'A. Sign one', 'B. Sign two', 'Answer: B'];
const NOTES = ['Some synthetic notes', 'without any options', 'at all'];
const first = pipelineQuestion('AB', { key: '3-6-0', number: 6 });
const last = pipelineQuestion('AB', { key: '3-8-0', number: 8 });
const point = { question: true, stem: [1], options: [2, 3], explanation: [4] };
const none = { question: false, stem: [], options: [], explanation: [] };

describe('reading leftover pictures as questions (M34 P4b, D6.1)', () => {
  it('builds a question from a picture and places it after the one before it', async () => {
    const reply = {
      items: [
        { n: 1, ...point },
        { n: 2, ...none },
      ],
    };
    const world = lessonWorld({ [LIGHT]: [recorded(reply)] });
    const leftovers = [
      picture('p3-u4', QUESTION, '3-6-0'),
      picture('p3-u5', NOTES, '3-6-0'),
      picture('p3-u6', ['too', 'short'], null),
    ];
    const run = await withStructure(world.deps, [first, last], leftovers);
    expect(world.calls).toHaveLength(1);
    expect(world.calls[0]?.request.parts.map((part) => part.type)).toEqual(['text']);
    expect(run.found).toEqual(['3-7-p3-u4']);
    expect(run.questions.map((question) => question.key)).toEqual(['3-6-0', '3-7-p3-u4', '3-8-0']);
    expect(run.questions[1]).toMatchObject({
      number: 7,
      stem: 'Which synthetic sign fits?',
      fromPicture: true,
      area: [{ page: 3, box: BOX }],
      answers: ['B'],
      evidence: ['printed_key'],
      explanation: 'Answer: B',
    });
  });

});

describe('leftover pictures that do not become questions (M34 P4b, D6.1)', () => {
  it('lists a picture no model could settle for review', async () => {
    const bad = recorded({ items: [{ n: 1, ...point, options: [2] }] });
    const world = lessonWorld({ [LIGHT]: [bad, bad], [STRONG]: [bad] });
    const run = await withStructure(world.deps, [first], [picture('p3-u4', QUESTION, null)]);
    expect(run.review).toEqual(['p3-u4']);
    expect(run.found).toEqual([]);
    expect(run.questions).toEqual([first]);
  });

  it('pauses on a full subscription and adds nothing', async () => {
    const world = lessonWorld({ [LIGHT]: [{ ok: false, failure: 'rate_limited' }] });
    const run = await withStructure(world.deps, [first], [picture('p3-u4', QUESTION, null)]);
    expect(run).toMatchObject({ paused: true, found: [], questions: [first] });
  });

  it('places pictures before the first question, and keeps one whose anchor is unknown', () => {
    const lead = pipelineQuestion('AB', { key: 'lead' });
    const lost = pipelineQuestion('AB', { key: 'lost' });
    const placed = insertAfter(
      [first, last],
      [
        { before: 'gone', question: lost },
        { before: null, question: lead },
      ],
    );
    expect(placed.map((question) => question.key)).toEqual(['lead', '3-6-0', '3-8-0', 'lost']);
  });
});
