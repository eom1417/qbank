import type { TriageChange } from '../../questions/index.js';
import { withoutOption } from '../domain/triage/reshape.js';
import type { Triaged } from './triage-answers.js';
import { shown, type Shown, type Work } from './triage-work.js';

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
  const label = evidence ?? (provenance === 'ai_verified' ? 'ai_consensus' : null);
  return { answers, provenance, evidence: label, fileAnswer: null, settled };
}

/** One verified question's new answer, from its outcome (DEC-03, DEC-16). */
function answerOf(work: Work, view: Shown, triaged: Triaged): Answer {
  const outcome = triaged.outcome;
  if (outcome.kind === 'answered') return chosen(outcome.letter, `ai_${outcome.how}`, null);
  if (outcome.kind === 'corrected') {
    // Against an earlier AI answer, the file's own answer (if it had one) is what stays shown.
    const earlier = work.row.answer_provenance === 'ai_verified';
    const file = earlier ? work.row.file_answer : outcome.fileLetter;
    return chosen(outcome.letter, 'ai_corrected', file);
  }
  return kept(work, view, outcome.kind !== 'unsettled');
}

/**
 * The answer of a question nobody verified (DEC-34): the file's, in the improved letters. An
 * answer read from the page (a key, a mark, a scan's own text) is the file's answer.
 */
function unchecked(work: Work, view: Shown): Answer {
  const row = work.row;
  const fromPage = view.printed || row.answer_provenance === 'ai_suggested';
  return {
    answers: view.file ? [view.file] : [],
    provenance: view.file && fromPage ? 'source' : row.answer_provenance,
    evidence: view.printed ? 'explanation' : row.answer_evidence,
    fileAnswer: row.file_answer,
    settled: null,
  };
}

const VERDICT_BADGES: Record<string, string> = {
  confirmed: 'answer_verified',
  answered: 'answer_verified',
  bad_option: 'answer_verified',
  corrected: 'answer_corrected',
};

/** What the AI changed, for the question's badges. */
function badgesOf(work: Work, view: Shown, triaged: Triaged | undefined, polish: boolean) {
  const badges: string[] = [];
  const improved = work.improved;
  const textChanged =
    improved !== null &&
    (view.stem !== work.row.stem ||
      JSON.stringify(view.options) !== JSON.stringify(work.row.options));
  if (textChanged) badges.push(polish ? 'polished' : 'organized');
  if (improved && improved.added.size > 0) badges.push('options_added');
  if (view.printed) badges.push('answer_from_text');
  const verdict = triaged ? VERDICT_BADGES[triaged.outcome.kind] : undefined;
  if (verdict) badges.push(verdict);
  return badges;
}

/** The deciding reason: the judge's, or the first solver's. */
const noteOf = (triaged: Triaged) => triaged.judge?.why || triaged.first.why || null;

/** The change for one question: its (improved) text, its answer, and what the AI changed. */
export function changeOf(work: Work, triaged: Triaged | undefined, polish: boolean): TriageChange {
  const bad = triaged?.outcome.kind === 'bad_option' ? triaged.outcome.letter : null;
  const improved = work.improved && bad ? withoutOption(work.improved, bad) : work.improved;
  const settledWork = { ...work, improved };
  const view = shown(settledWork);
  const answer = triaged ? answerOf(settledWork, view, triaged) : unchecked(settledWork, view);
  return {
    kind: view.options.length > 0 ? 'mcq' : work.row.kind,
    stem: view.stem,
    options: view.options,
    improved: improved !== null,
    aiNote: triaged ? noteOf(triaged) : work.row.ai_note,
    changes: badgesOf(settledWork, view, triaged, polish),
    ...answer,
  };
}
