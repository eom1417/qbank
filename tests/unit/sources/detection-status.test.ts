import { expect, it } from 'vitest';
import { importedQuestions } from '../../../src/server/capabilities/sources/use-cases/read-with-pipeline.js';
import type { PipelineQuestion } from '../../../src/server/capabilities/sources/domain/pipeline/question.js';

it('keeps a detection doubt through saving even when the printed answer is valid', () => {
  const question: PipelineQuestion = {
    key: '1-1-0',
    number: 1,
    page: 1,
    pages: [1],
    stem: 'Which sample is correct?',
    options: ['A', 'B'].map((letter) => ({
      letter,
      label: letter,
      text: `Sample ${letter}`,
      spot: null,
    })),
    area: [],
    explanation: null,
    pictures: [],
    answers: ['A'],
    evidence: ['printed_key'],
    conflicts: [],
    fromPicture: false,
    caseText: null,
    tags: { exam: null, year: null },
    reviewReasons: ['detection_doubt'],
  };
  const [saved] = importedQuestions([question], new Map());
  expect(saved?.reasons).toContain('detection_doubt');
});
