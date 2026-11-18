import { expect, it } from 'vitest';
import { rolesLesson } from '../../../src/server/capabilities/sources/domain/pipeline/lessons/roles.js';
import { runLesson } from '../../../src/server/capabilities/sources/use-cases/run-lesson.js';
import { crop, lessonWorld, LIGHT, recorded, textOf } from '../../support/lesson-world.js';

it('sends numbered source lines alongside optional OCR pixels', async () => {
  const world = lessonWorld({
    [LIGHT]: [
      recorded({
        items: [{ n: 1, lines: [{ id: 0, role: 'stem', number: null, letter: null, text: null }] }],
      }),
    ],
  });
  await runLesson(world.deps, rolesLesson, [
    {
      input: { lines: [0] },
      fingerprint: 'ocr-pixels-and-lines',
      image: crop(),
      text: '0 [ocr]: Source words',
    },
  ]);
  expect(world.calls[0]?.request.parts.some((part) => part.type === 'image')).toBe(true);
  expect(textOf(world.calls, 0)).toContain('0 [ocr]: Source words');
});
