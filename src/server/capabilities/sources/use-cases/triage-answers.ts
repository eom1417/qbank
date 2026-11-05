import type { AiFailure, AiProvider } from '../../providers/index.js';
import { mapWithLimit } from '../../../platform/concurrency.js';
import { askBatch } from './ask-batch.js';
import { batches, reversed, type TriageQuestion } from '../domain/triage/batch.js';
import { JUDGE_PROMPT, JudgeReply, judgeText, verdictsOf } from '../domain/triage/judge.js';
import type { Disputed, Verdict } from '../domain/triage/judge.js';
import { SOLVE_PROMPT, SolveReply, solutionsOf, solveText } from '../domain/triage/solve.js';
import type { Solution } from '../domain/triage/solve.js';
import { decide, needsJudge, type Outcome, type Votes } from '../domain/triage/verdict.js';

/** Requests in flight at once on one subscription. */
const PARALLEL = 3;

export interface TriageItem {
  question: TriageQuestion;
  /** The file's answer, if it has one; the solvers never see it. */
  file: string | null;
  /** Letters of options the improvement added. */
  added: ReadonlySet<string>;
}

/** The models of one triage: two independent solvers and a judge for disagreements. */
export interface TriageRoles {
  first: AiProvider;
  second: AiProvider;
  judge: AiProvider;
}

export interface Triaged {
  outcome: Outcome;
  first: Solution;
  second: Solution;
  judge: Verdict | null;
}

export interface TriageResult {
  byId: Map<string, Triaged>;
  /** Why the AI stopped, when it did; questions it did not finish are left out of `byId`. */
  failure: AiFailure | null;
}

type Solved = { solutions: Map<string, Solution>; failure: AiFailure | null };

/** One solver over every question, in batches; the second sees the options reversed. */
async function solveAll(provider: AiProvider, questions: TriageQuestion[], flip: boolean) {
  const replies = await mapWithLimit(batches(questions), PARALLEL, async (batch) => {
    const shown = batch.map((question) => (flip ? reversed(question) : { question, back: null }));
    const asked = shown.map((entry) => entry.question);
    const reply = await askBatch(provider, {
      name: 'solve_questions',
      system: SOLVE_PROMPT,
      parts: [{ type: 'text', text: solveText(asked) }],
      schema: SolveReply,
    });
    if (!reply.ok) return { failure: reply.failure, solutions: [] as [string, Solution][] };
    const found = solutionsOf(reply.value, asked);
    const solutions = shown.map(({ question, back }): [string, Solution] => {
      const solution = found.get(question.id) ?? { letter: null, why: '' };
      const letter =
        solution.letter && back ? (back.get(solution.letter) ?? null) : solution.letter;
      return [question.id, { ...solution, letter }];
    });
    return { failure: null, solutions };
  });
  return {
    solutions: new Map(replies.flatMap((reply) => reply.solutions)),
    failure: replies.find((reply) => reply.failure)?.failure ?? null,
  } satisfies Solved;
}

async function judgeAll(provider: AiProvider, disputes: Disputed[]) {
  const replies = await mapWithLimit(batches(disputes), PARALLEL, async (batch) => {
    const reply = await askBatch(provider, {
      name: 'judge_questions',
      system: JUDGE_PROMPT,
      parts: [{ type: 'text', text: judgeText(batch) }],
      schema: JudgeReply,
    });
    return reply.ok
      ? { failure: null, verdicts: [...verdictsOf(reply.value, batch)] }
      : { failure: reply.failure, verdicts: [] as [string, Verdict][] };
  });
  return {
    verdicts: new Map(replies.flatMap((reply) => reply.verdicts)),
    failure: replies.find((reply) => reply.failure)?.failure ?? null,
  };
}

const votesOf = (item: TriageItem, first: Solution, second: Solution): Votes => ({
  file: item.file,
  first: first.letter,
  second: second.letter,
});

function disputesOf(items: TriageItem[], first: Solved, second: Solved): Disputed[] {
  return items.flatMap((item) => {
    const a = first.solutions.get(item.question.id);
    const b = second.solutions.get(item.question.id);
    if (!a || !b || !needsJudge(votesOf(item, a, b))) return [];
    const file = { from: 'source file', letter: item.file, why: '' };
    const candidates = [
      ...(item.file ? [file] : []),
      { from: 'solver 1', ...a },
      { from: 'solver 2', ...b },
    ];
    return [{ question: item.question, candidates }];
  });
}

/**
 * The triage of answers (DEC-33): two solvers answer every question blind and in parallel, the
 * judge looks only at disagreements, and `decide` turns the votes into an outcome per question.
 */
export async function triageAnswers(
  items: TriageItem[],
  roles: TriageRoles,
): Promise<TriageResult> {
  const questions = items.map((item) => item.question);
  const [first, second] = await Promise.all([
    solveAll(roles.first, questions, false),
    solveAll(roles.second, questions, true),
  ]);
  const judged = await judgeAll(roles.judge, disputesOf(items, first, second));
  const byId = new Map<string, Triaged>();
  for (const item of items) {
    const id = item.question.id;
    const a = first.solutions.get(id);
    const b = second.solutions.get(id);
    if (!a || !b) continue;
    const judge = judged.verdicts.get(id) ?? null;
    const disputed = needsJudge(votesOf(item, a, b));
    if (disputed && !judge && judged.failure) continue;
    byId.set(id, {
      outcome: decide(votesOf(item, a, b), judge, item.added),
      first: a,
      second: b,
      judge,
    });
  }
  return { byId, failure: first.failure ?? second.failure ?? judged.failure };
}
