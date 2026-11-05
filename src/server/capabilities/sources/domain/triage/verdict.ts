import type { Verdict } from './judge.js';

/** What the triage found for one question's answer. */
export type Outcome =
  /** The file's answer, confirmed by the solvers (or the judge). */
  | { kind: 'confirmed' }
  /** No answer in the file: the solvers agreed, or the judge sided with one of them. */
  | { kind: 'answered'; letter: string; how: 'consensus' | 'judged' }
  /** Both solvers and the judge agree on another answer than the file's (DEC-16). */
  | { kind: 'corrected'; letter: string; fileLetter: string }
  /** An option the improvement added beat the file's answer: it is not a fair distractor. */
  | { kind: 'bad_option'; letter: string }
  /** Nothing settles it: a person decides. */
  | { kind: 'unsettled' };

export interface Votes {
  file: string | null;
  first: string | null;
  second: string | null;
}

const agreed = ({ first, second }: Votes) => first !== null && first === second;

/** The solvers agree with each other and with the file (or the file has no answer). */
const settledBySolvers = (votes: Votes) =>
  agreed(votes) && (votes.file === null || votes.file === votes.first);

/** Whether the judge has to look: any disagreement, or no solver answer at all. */
export const needsJudge = (votes: Votes) => !settledBySolvers(votes);

function againstFile(votes: Votes, letter: string, added: ReadonlySet<string>): Outcome {
  if (added.has(letter)) return { kind: 'bad_option', letter };
  const unanimous = votes.first === letter && votes.second === letter;
  return unanimous && votes.file !== null
    ? { kind: 'corrected', letter, fileLetter: votes.file }
    : { kind: 'unsettled' };
}

/** The judge's part, once the solvers did not settle the question on their own. */
function byJudge(votes: Votes, judge: Verdict, added: ReadonlySet<string>): Outcome {
  const letter = judge.letter;
  if (letter === null) return { kind: 'unsettled' };
  const backed = letter === votes.first || letter === votes.second;
  // The file, a solver and the judge: three votes against one settle it, sure or not.
  if (letter === votes.file && (judge.decisive || backed)) return { kind: 'confirmed' };
  if (!judge.decisive) return { kind: 'unsettled' };
  if (votes.file !== null) return againstFile(votes, letter, added);
  return backed ? { kind: 'answered', letter, how: 'judged' } : { kind: 'unsettled' };
}

/**
 * The answer rule of the triage (DEC-03, DEC-16, DEC-33). Two independent solvers that agree
 * settle a question; otherwise a decisive judge that sides with a solver does, or the judge,
 * the file and a solver together. The file's answer is overturned only when both solvers and a
 * decisive judge agree against it.
 */
export function decide(votes: Votes, judge: Verdict | null, added: ReadonlySet<string>): Outcome {
  if (settledBySolvers(votes))
    return votes.file === null
      ? { kind: 'answered', letter: votes.first ?? '', how: 'consensus' }
      : { kind: 'confirmed' };
  return judge ? byJudge(votes, judge, added) : { kind: 'unsettled' };
}
