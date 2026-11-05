import type { Enhancements } from '../../../../contracts/sources.js';
import type { AiFailure, AiProvider } from '../../providers/index.js';
import type { QuestionRow, ReviewReason } from '../../questions/index.js';
import type { SourcesDeps } from './deps.js';
import { checkNewOptions, guardMeaning } from './check-improvements.js';
import { improveQuestions } from './improve-questions.js';
import {
  triageAnswers,
  type Triaged,
  type TriageResult,
  type TriageRoles,
} from './triage-answers.js';
import { changeOf } from './triage-change.js';
import {
  asTriage,
  fileAnswerOf,
  isOpen,
  shown,
  triageable,
  worksOf,
  type Work,
} from './triage-work.js';

/** The models of one run and what the owner chose to improve (DEC-33, DEC-34). */
export interface TriageSettings {
  team: TriageRoles & { improver: AiProvider };
  enhance: Enhancements;
}

/**
 * Organizing (always) and the chosen text improvements. New options only where the answer is
 * known or will be verified, so a new option is never left unchecked.
 */
async function improveAll(works: Work[], settings: TriageSettings) {
  const { enhance } = settings;
  const items = works.map((work) => {
    const right = fileAnswerOf(work.row);
    const mayAdd = enhance.completeOptions > 0 && (enhance.verifyAnswers || right !== null);
    return { question: work.question, right, mayAdd };
  });
  const rules = { polish: enhance.polishText, most: enhance.completeOptions };
  const result = await improveQuestions(settings.team.improver, items, rules);
  for (const work of works) work.improved = result.byId.get(work.question.id) ?? null;
  return result.failure;
}

/** The meaning guard, then the answers: verified by the team, or new options checked once. */
async function settleAnswers(works: Work[], settings: TriageSettings): Promise<TriageResult> {
  const { enhance, team } = settings;
  const guarded = enhance.polishText ? await guardMeaning(team.first, works) : null;
  if (!enhance.verifyAnswers) {
    const checked = await checkNewOptions(team.first, works);
    return { byId: new Map(), failure: guarded ?? checked };
  }
  const items = works.flatMap((work) => {
    const view = shown(work);
    if (view.options.length < 2) return [];
    const added = work.improved?.added ?? new Set<string>();
    return [{ question: asTriage(work.question.id, view), file: view.file, added }];
  });
  const result = await triageAnswers(items, team);
  return { byId: result.byId, failure: guarded ?? result.failure };
}

/**
 * A question that was open stays open unless it ends with an answer (the triage settled it, or
 * the file printed it): as multiple choice with no answer it would only wait in review; open, it
 * is a topic card (DEC-34). Its options may be new or found in its text.
 */
function keptConversion(work: Work, triaged: Triaged | undefined) {
  const wasOpen = (work.row.options as unknown[]).length === 0;
  if (!wasOpen || !work.improved || work.improved.options.length === 0) return triaged;
  const answered = triaged ? triaged.outcome.kind !== 'unsettled' : shown(work).file !== null;
  if (answered) return triaged;
  work.improved = null;
  return undefined;
}

export interface TriageReport {
  /** Questions the AI changed (text, answer or both). */
  changed: number;
  /** Questions whose answer it settled, so nobody has to. */
  settled: number;
  failure: AiFailure | null;
}

/**
 * The AI's work on saved questions (DEC-33, DEC-34): organize them, improve what the owner chose,
 * settle answers when asked, and save each as its next version (origin `ai_triage`; the original
 * stays version 1). The owner's own answers and edits are never touched. Used after every import
 * with an AI, and by "check again" on a source.
 */
export async function triageRows(
  deps: Pick<SourcesDeps, 'questions'>,
  owner: { ownerId: string; now: Date },
  rows: readonly QuestionRow[],
  settings: TriageSettings,
): Promise<TriageReport> {
  const works = worksOf(rows);
  const improveFailure = await improveAll(works, settings);
  const result = await settleAnswers(works, settings);
  const report: TriageReport = {
    changed: 0,
    settled: 0,
    failure: improveFailure ?? result.failure,
  };
  for (const row of rows.filter((r) => isOpen(r) && !triageable(r)))
    await deps.questions.refreshStatus(owner, row);
  for (const work of works) {
    const triaged = keptConversion(work, result.byId.get(work.question.id));
    if (!triaged && !work.improved && work.row.answer_provenance !== 'ai_suggested') {
      await deps.questions.refreshStatus(owner, work.row);
      continue;
    }
    const change = changeOf(work, triaged, settings.enhance.polishText);
    const reasons = work.row.review_reasons as ReviewReason[];
    await deps.questions.applyTriage(
      owner,
      { id: work.row.id, reasons, changes: work.row.ai_changes },
      change,
    );
    report.changed += 1;
    if (change.settled) report.settled += 1;
  }
  return report;
}
