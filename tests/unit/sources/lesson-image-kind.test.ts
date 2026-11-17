import { describe, expect, it } from 'vitest';
import {
  IMAGE_KINDS,
  imageKindLesson,
} from '../../../src/server/capabilities/sources/domain/pipeline/lessons/image-kind.js';
import { buildPrompt } from '../../../src/server/capabilities/sources/domain/pipeline/prompt-standard.js';
import { runLesson } from '../../../src/server/capabilities/sources/use-cases/run-lesson.js';
import { crop, LIGHT, lessonWorld, recorded, STRONG, textOf } from '../../support/lesson-world.js';

// M34 P4b: lesson D1.2 (what an unsure image is) on RECORDED replies only.

const items = ['p2-u4', 'p3-u9', 'p5-u1'].map((unitId, i) => ({
  input: { unitId },
  fingerprint: `img-${i}`,
  image: crop(40 + i * 60),
  text: null,
}));

describe('lesson D1.2: the card (M34 P4b)', () => {
  it('accepts exactly the five kinds', () => {
    for (const kind of IMAGE_KINDS)
      expect(imageKindLesson.schema.safeParse({ kind }).success).toBe(true);
    expect(imageKindLesson.schema.safeParse({ kind: 'photo' }).success).toBe(false);
    expect(imageKindLesson.schema.safeParse({}).success).toBe(false);
  });

  it('has nothing to check beyond the shape', () => {
    expect(imageKindLesson.check({ unitId: 'p1-u1' }, { kind: 'mixed' })).toBeNull();
  });

  it('is a vision lesson asking one closed question over a sheet', () => {
    expect(imageKindLesson).toMatchObject({ id: 'D1.2', level: 1, needs: 'vision' });
    const prompt = buildPrompt(imageKindLesson, { count: 3, texts: null });
    expect(prompt.text).toContain('"printed_words"');
    expect(prompt.text).toContain('{"items":[{"n":1,"kind":…}');
  });
});

describe('lesson D1.2: running it (M34 P4b)', () => {
  it('answers three images in one light call', async () => {
    const reply = {
      items: [
        { n: 1, kind: 'printed_words' },
        { n: 2, kind: 'picture' },
        { n: 3, kind: 'table' },
      ],
    };
    const world = lessonWorld({ [LIGHT]: [recorded(reply)] });
    const run = await runLesson(world.deps, imageKindLesson, items);
    expect(
      run.results.map((result) => result?.status === 'answered' && result.output.kind),
    ).toEqual(['printed_words', 'picture', 'table']);
    expect(world.calls).toHaveLength(1);
  });

  it('asks again for a kind outside the five, then sends it to review', async () => {
    const off = recorded({ items: [{ n: 1, kind: 'diagram' }] });
    const world = lessonWorld({ [LIGHT]: [off, off], [STRONG]: [off] });
    const run = await runLesson(world.deps, imageKindLesson, items.slice(0, 1));
    expect(textOf(world.calls, 1)).toContain('Your previous reply had these errors');
    expect(run.results[0]).toEqual({ status: 'review', reason: 'image_kind_unclear' });
  });
});
