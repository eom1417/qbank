import type { StudyDeps } from './deps.js';

/** The question's difficulty from every graded answer the owner gave it (FR-11-005). */
export async function noteDifficulty(deps: StudyDeps, ownerId: string, questionId: string) {
  const attempts = await deps.sessions.attemptsOf(ownerId, questionId);
  const correct = attempts.filter((a) => a.correct === true).length;
  await deps.questions.inferDifficulty(ownerId, questionId, correct, attempts.length);
}
