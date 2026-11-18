import { expect, it, vi } from 'vitest';
import { questionsFromPages } from '../../../src/server/capabilities/sources/use-cases/extract-questions.js';

vi.mock('../../../src/server/capabilities/sources/domain/questions.js', async (original) => ({
  ...(await original<
    typeof import('../../../src/server/capabilities/sources/domain/questions.js')
  >()),
  parseQuestions: () => {
    throw new Error('retired parser must not run');
  },
}));

it('reads the legacy entrypoint through line roles without the retired parser', async () => {
  const lines = ['Question: 1', 'Which sample?', 'A. Copper', 'B. Zinc', 'Answer: B'];
  const words = lines.flatMap((line, row) =>
    line.split(' ').map((text, column) => ({
      text,
      font: 'Calibri',
      box: { x0: 30 + column * 60, x1: 80 + column * 60, y0: 50 + row * 20, y1: 62 + row * 20 },
    })),
  );
  const pages = [{ page: 1, width: 600, height: 800, visual: true, words }];
  const white = { width: 600, height: 800, scale: 1, pixels: new Uint8Array(600 * 800).fill(255) };
  const questions = await questionsFromPages('synthetic.pdf', pages, async () => white);
  expect(questions.map((question) => [question.number, question.answer])).toEqual([[1, 'B']]);
});
