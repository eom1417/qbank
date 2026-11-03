import type { JobRow, SourceRow } from '../adapters/import-repository.js';
import { matchKeys } from '../domain/answer-keys.js';
import { keyEntries, type KeyEntry } from '../domain/key-lines.js';
import { bodyFontFamilies, pageLines } from '../domain/lines.js';
import type { PageText } from '../domain/page.js';
import type { SourcesDeps } from './deps.js';

/** Every key entry in the file's lines, in reading order; headings and other text are skipped. */
function entriesOf(pages: readonly PageText[]): KeyEntry[] {
  const body = bodyFontFamilies(pages.filter((page) => page.visual));
  return pages
    .flatMap((page) => pageLines(page, page.visual ? body : null))
    .flatMap((line) => keyEntries(line.text) ?? []);
}

/**
 * Stage 2 for an answer-key file (M6.3, JY-03): its entries are matched to the questions of the
 * source it answers, by chapter run and number, and applied as that source's key. Returns how
 * many questions got an answer and how many of those disagree with what was there.
 */
export async function applyAnswerFile(
  deps: SourcesDeps,
  job: JobRow,
  source: SourceRow,
  pages: readonly PageText[],
) {
  const targetId = source.answers_for_source_id;
  if (!targetId) return { matched: 0, conflicts: 0 };
  const questions = await deps.questions.questionsOfSource(job.owner_id, targetId);
  const entries = entriesOf(pages);
  const answers = matchKeys(
    questions.map((question) => question.source_number),
    [{ position: questions.length - 1, entries }],
  );
  let matched = 0;
  for (const [index, letters] of answers.entries()) {
    const question = questions[index];
    if (!letters || !question) continue;
    if (await deps.questions.applyAnswerFile(job.owner_id, question.id, letters, deps.clock.now()))
      matched += 1;
  }
  const after = await deps.questions.questionsOfSource(job.owner_id, targetId);
  const conflicts = after.filter(
    (q) => q.answer_evidence === 'answer_file' && q.answer_provenance === 'conflict',
  ).length;
  return { matched, conflicts };
}
