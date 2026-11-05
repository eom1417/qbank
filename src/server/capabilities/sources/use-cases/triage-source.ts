import type { AiFailure, AiProvider } from '../../providers/index.js';
import type { QuestionRow, ReviewReason, TriageChange } from '../../questions/index.js';
import type { TriageQuestion } from '../domain/triage/batch.js';
import { withoutOption, type Reshaped } from '../domain/triage/reshape.js';
import type { SourcesDeps } from './deps.js';
import { improveQuestions } from './improve-questions.js';
import { triageAnswers, type TriageRoles, type Triaged } from './triage-answers.js';

export interface TriageSettings extends TriageRoles {
  /** The improver, when improvement mode is on (DEC-04); null leaves the text as it is. */
  improver: AiProvider | null;
}

type Option = { letter: string; label: string; text: string };

/** Questions whose status follows the rules (an excluded or archived one is the owner's call). */
const open = (row: QuestionRow) =>
  row.status === 'needs_review' || row.status === 'eligible' || row.status === 'detected';

/** Questions the triage may change: not the owner's own decisions, not multiple-select. */
const triageable = (row: QuestionRow) =>
  open(row) &&
  row.answer_provenance !== 'manual' &&
  row.owner_edited_at === null &&
  !row.multi_select;

/**
 * Answers that vote like the file's: printed or marked, read by the AI, verified before, or the
 * file's answer an earlier triage disputed.
 */
const PRIOR: ReadonlySet<string> = new Set(['source', 'ai_suggested', 'ai_verified', 'conflict']);

/**
 * The answer the question already has (a printed key, a mark, the only typed option, or one a
 * triage verified before), if any: a re-check overturns it only as it would the file's.
 */
const fileAnswerOf = (row: QuestionRow) =>
  PRIOR.has(row.answer_provenance) ? row.answer_letter : null;

interface Work {
  row: QuestionRow;
  question: TriageQuestion;
  improved: Reshaped | null;
}

interface Shown {
  stem: string;
  options: Option[];
  /** The file's answer in the shown letters: its own, or the one its text gave (a scan). */
  file: string | null;
  printed: boolean;
}

/** The question as the solvers see it: improved when improvement mode accepted a rewrite. */
function shown(work: Work): Shown {
  const file = fileAnswerOf(work.row);
  const options = work.row.options as Option[];
  if (!work.improved) return { stem: work.row.stem, options, file, printed: false };
  const moved = file ? (work.improved.moved.get(file) ?? null) : null;
  const printed = moved === null ? work.improved.printed : null;
  return {
    stem: work.improved.stem,
    options: work.improved.options,
    file: moved ?? printed,
    printed: printed !== null,
  };
}

type Answer = Pick<TriageChange, 'answers' | 'provenance' | 'evidence' | 'fileAnswer' | 'settled'>;

/** An answer the AI chose over none or over the file's: always `ai_verified`. */
const chosen = (letter: string, evidence: string, fileAnswer: string | null): Answer => ({
  answers: [letter],
  provenance: 'ai_verified',
  evidence,
  fileAnswer,
  settled: true,
});

/** The question keeps the answer it had: confirmed, or left to a person when unsettled. */
function kept(work: Work, view: Shown, settled: boolean): Answer {
  const answers = view.file ? [view.file] : [];
  const evidence = view.printed ? 'explanation' : work.row.answer_evidence;
  if (!settled) {
    const provenance = view.file ? 'conflict' : 'missing';
    // An AI evidence label does not outlive the answer it named.
    const left = evidence?.startsWith('ai_') ? null : evidence;
    return { answers, provenance, evidence: left, fileAnswer: null, settled };
  }
  const provenance = work.row.answer_provenance === 'source' ? 'source' : 'ai_verified';
  const shown = evidence ?? (provenance === 'ai_verified' ? 'ai_consensus' : null);
  return { answers, provenance, evidence: shown, fileAnswer: null, settled };
}

/** One triaged question's new answer, from its outcome (DEC-03, DEC-16). */
function answerOf(work: Work, view: Shown, triaged: Triaged): Answer {
  const outcome = triaged.outcome;
  if (outcome.kind === 'answered') return chosen(outcome.letter, `ai_${outcome.how}`, null);
  if (outcome.kind === 'corrected') {
    // Against an earlier AI answer, the file's own answer (if it had one) is what stays shown.
    const earlier = work.row.answer_provenance === 'ai_verified';
    return chosen(
      outcome.letter,
      'ai_corrected',
      earlier ? work.row.file_answer : outcome.fileLetter,
    );
  }
  return kept(work, view, outcome.kind !== 'unsettled');
}

/** The improved text, without a distractor the triage found unfair. */
function finalText(work: Work, triaged: Triaged | undefined) {
  const bad = triaged?.outcome.kind === 'bad_option' ? triaged.outcome.letter : null;
  const improved = work.improved && bad ? withoutOption(work.improved, bad) : work.improved;
  const view = shown({ ...work, improved });
  const text = {
    kind: view.options.length > 0 ? ('mcq' as const) : work.row.kind,
    stem: view.stem,
    options: view.options,
    improved: improved !== null,
  };
  return { text, view };
}

/** The change for one question: its (improved) text and the answer the triage settled. */
function changeOf(work: Work, triaged: Triaged | undefined): TriageChange {
  const { text, view } = finalText(work, triaged);
  if (triaged) {
    const aiNote = triaged.judge?.why || triaged.first.why || null;
    return { ...text, aiNote, ...answerOf(work, view, triaged) };
  }
  const { answer_letters: answers, answer_provenance: provenance } = work.row;
  const evidence = work.row.answer_evidence;
  return { ...text, answers, provenance, evidence, fileAnswer: null, aiNote: null, settled: false };
}

const asTriage = (id: string, view: { stem: string; options: Option[] }): TriageQuestion => ({
  id,
  stem: view.stem,
  options: view.options.map(({ letter, text }) => ({ letter, text })),
});

/** Improvement mode first (when on): the solvers then answer the improved questions. */
async function improveAll(works: Work[], improver: AiProvider | null) {
  if (!improver) return null;
  const items = works.map((work) => ({ question: work.question, right: fileAnswerOf(work.row) }));
  const result = await improveQuestions(improver, items);
  for (const work of works) work.improved = result.byId.get(work.question.id) ?? null;
  return result.failure;
}

export interface TriageReport {
  /** Questions the triage changed (text, answer or both). */
  changed: number;
  /** Questions whose answer it settled, so nobody has to. */
  settled: number;
  failure: AiFailure | null;
}

/**
 * The AI triage of saved questions (DEC-33): improve them when asked, settle each answer with
 * two blind solvers and a judge, and save the result as each question's next version. Used
 * after every import that has an AI, and by "check again" on an existing source.
 */
export async function triageRows(
  deps: Pick<SourcesDeps, 'questions'>,
  owner: { ownerId: string; now: Date },
  rows: readonly QuestionRow[],
  settings: TriageSettings,
): Promise<TriageReport> {
  const works: Work[] = rows.filter(triageable).map((row, index) => {
    const question = asTriage(`q${index + 1}`, {
      stem: row.stem,
      options: row.options as Option[],
    });
    return { row, question, improved: null };
  });
  const improveFailure = await improveAll(works, settings.improver);
  const items = works.flatMap((work) => {
    const view = shown(work);
    if (view.options.length < 2) return [];
    const added = work.improved?.added ?? new Set<string>();
    return [{ question: asTriage(work.question.id, view), file: view.file, added }];
  });
  const result = await triageAnswers(items, settings);
  const report: TriageReport = {
    changed: 0,
    settled: 0,
    failure: improveFailure ?? result.failure,
  };
  for (const row of rows.filter((r) => open(r) && !triageable(r)))
    await deps.questions.refreshStatus(owner, row);
  for (const work of works) {
    const triaged = result.byId.get(work.question.id);
    if (!triaged && !(work.improved && shown(work).options.length < 2)) {
      await deps.questions.refreshStatus(owner, work.row);
      continue;
    }
    const change = changeOf(work, triaged);
    const reasons = work.row.review_reasons as ReviewReason[];
    await deps.questions.applyTriage(owner, { id: work.row.id, reasons }, change);
    report.changed += 1;
    if (change.settled) report.settled += 1;
  }
  return report;
}
