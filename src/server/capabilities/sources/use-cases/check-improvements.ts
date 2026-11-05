import type { AiProvider } from '../../providers/index.js';
import { withoutOption } from '../domain/triage/reshape.js';
import { solveAll } from './triage-answers.js';
import { asTriage, shown, type Work } from './triage-work.js';

/** Polished questions whose text changed: their meaning is checked against the original. */
const polishedOnes = (works: readonly Work[]) =>
  works.filter((work) => {
    const improved = work.improved;
    return (
      improved !== null &&
      improved.stem !== work.row.stem &&
      (work.row.options as unknown[]).length >= 2
    );
  });

/** Both versions were answered, and not with the same option. */
function changedMeaning(
  work: Work,
  was: string | null | undefined,
  now: string | null | undefined,
) {
  if (!was || !now) return false;
  return work.improved?.moved.get(was) !== now;
}

/**
 * The meaning guard of polishing (DEC-34): one model answers the original and the polished
 * question blind; when both answer and the answers differ (in the original's letters), the
 * rewrite changed what is asked and the question keeps its original text.
 */
export async function guardMeaning(provider: AiProvider, works: readonly Work[]) {
  const checked = polishedOnes(works);
  if (checked.length === 0) return null;
  const originals = checked.map((work) => work.question);
  const rewritten = checked.map((work) => asTriage(work.question.id, shown(work)));
  const [before, after] = await Promise.all([
    solveAll(provider, originals, false),
    solveAll(provider, rewritten, false),
  ]);
  for (const work of checked) {
    const id = work.question.id;
    if (changedMeaning(work, before.solutions.get(id)?.letter, after.solutions.get(id)?.letter))
      work.improved = null;
  }
  return before.failure ?? after.failure;
}

/**
 * New options when nobody verifies the answers (DEC-34): one model answers the question blind,
 * and a new option it picks over the file's answer is dropped (it may be right, too).
 */
export async function checkNewOptions(provider: AiProvider, works: readonly Work[]) {
  const checked = works.filter((work) => (work.improved?.added.size ?? 0) > 0 && shown(work).file);
  if (checked.length === 0) return null;
  const solved = await solveAll(
    provider,
    checked.map((work) => asTriage(work.question.id, shown(work))),
    false,
  );
  for (const work of checked) {
    const letter = solved.solutions.get(work.question.id)?.letter;
    if (work.improved && letter && work.improved.added.has(letter) && letter !== shown(work).file)
      work.improved = withoutOption(work.improved, letter);
  }
  return solved.failure;
}
