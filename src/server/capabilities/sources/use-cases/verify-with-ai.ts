import type { AiProvider } from '../../ai/index.js';
import type { ImportedQuestion } from '../../questions/index.js';
import type { JobRow } from '../adapters/import-repository.js';
import { auditSample } from '../domain/screening.js';
import type { SourcesDeps } from './deps.js';
import { askMark, pageImages } from './suggest-marks.js';

interface Verified {
  questions: ImportedQuestion[];
  /** `not_used`, `done`, `not_ready` (connection missing) or why the provider stopped. */
  aiOutcome: string;
}

const withoutReason = (question: ImportedQuestion, reason: string) =>
  question.reasons.filter((other) => other !== reason);

/** Applies one AI reply: a suggestion for an undecided question, or a check of a decided one. */
function applyMark(question: ImportedQuestion, letter: string | null): ImportedQuestion {
  if (letter === null) return question;
  if (question.answer === null) {
    const reasons = [...withoutReason(question, 'no_answer'), 'ai_suggested' as const];
    return {
      ...question,
      answer: letter,
      answers: [letter],
      provenance: 'ai_suggested',
      evidence: 'ai_suggested',
      reasons,
    };
  }
  if (letter === question.answer) return question;
  // The AI read another mark than the rules: a person decides (nothing is chosen silently).
  return { ...question, provenance: 'conflict', reasons: [...question.reasons, 'ai_disagrees'] };
}

const needsAi = (question: ImportedQuestion, audit: ReadonlySet<number>) =>
  question.kind === 'mcq' &&
  !question.multiSelect &&
  question.options.length >= 2 &&
  (question.answer === null || audit.has(question.number));

async function askAll(
  file: string,
  provider: AiProvider,
  questions: ImportedQuestion[],
): Promise<Verified> {
  const audit = auditSample(questions);
  const image = pageImages(file);
  const result = [...questions];
  for (const [index, question] of questions.entries()) {
    if (!needsAi(question, audit)) continue;
    const reply = await askMark(question, provider, await image(question.page));
    // A refused key or an empty quota stops the AI step; what is done so far is kept (JY-14).
    if (!reply.ok) return { questions: result, aiOutcome: reply.failure };
    result[index] = applyMark(question, reply.letter);
  }
  return { questions: result, aiOutcome: 'done' };
}

/**
 * Step 3–4 of the import: the user's own AI looks only at undecided questions plus an audit
 * sample of decided ones. Without a connection the rules' result stands as it is.
 */
export async function verifyWithAi(
  deps: SourcesDeps,
  job: JobRow,
  file: string,
  questions: ImportedQuestion[],
): Promise<Verified> {
  if (!job.ai_provider_id) return { questions, aiOutcome: 'not_used' };
  const provider = await deps.ai.openOwned(job.owner_id, job.ai_provider_id);
  if (!provider) return { questions, aiOutcome: 'not_ready' };
  return askAll(file, provider, questions);
}
