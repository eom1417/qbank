import type { SharePolicy } from '../../../../contracts/sharing.js';
import { shuffled, type Snapshot } from '../../exam-rules/index.js';
import type { PoolQuestion } from '../../questions/index.js';

/**
 * Which questions one exam/practice attempt gets (M30, DEC-39). Pure: the caller passes the
 * share's ready pool and the randomness.
 */

type Content = Pick<SharePolicy['content'], 'size' | 'fixedQuestionIds'>;

/** Questions in each attempt: the policy's size, or every fixed question when there are more. */
export const attemptSize = (content: Content) =>
  Math.max(content.size, content.fixedQuestionIds.length);

/**
 * The fixed questions that are still ready, then a random draw from the rest, up to the
 * attempt's size; one question per exact text; asked in a random order. Null when the ready
 * pool cannot fill an attempt.
 */
export function drawQuestions(
  pool: readonly PoolQuestion[],
  content: Content,
  random: () => number,
): PoolQuestion[] | null {
  const size = attemptSize(content);
  const fixed = new Set(content.fixedQuestionIds);
  const candidates = [
    ...pool.filter((q) => fixed.has(q.id)),
    ...shuffled(
      pool.filter((q) => !fixed.has(q.id)),
      random,
    ),
  ];
  const texts = new Set<string>();
  const picked: PoolQuestion[] = [];
  for (const question of candidates) {
    if (picked.length === size) break;
    if (texts.has(question.exactKey)) continue;
    texts.add(question.exactKey);
    picked.push(question);
  }
  return picked.length < size ? null : shuffled(picked, random);
}

/** The question as the attempt keeps it, whatever happens to it in the bank afterwards. */
export function snapshotOf(question: PoolQuestion): Snapshot {
  const { stem, options, answers, multiSelect, explanation, pictureIds, chapterId, version } =
    question;
  return { stem, options, answers, multiSelect, explanation, pictureIds, chapterId, version };
}
