import { randomInt } from 'node:crypto';

/** What the next batch takes, and whether a new cycle begins with it (DEC-36). */
export interface Pick {
  questionIds: string[];
  cycle: number;
  /** Nothing is left to send after this batch, and the channel stops when that happens. */
  done: boolean;
}

interface Choice {
  ready: readonly string[];
  /** Questions this cycle has already sent. */
  sent: ReadonlySet<string>;
  cycle: number;
  size: number;
  whenDone: 'restart' | 'stop';
}

/** A fair shuffle, so each batch is drawn evenly from what is left. */
function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/**
 * The next batch: questions this cycle has not sent, at random. When every ready question has
 * gone, a `restart` channel begins a new cycle (all of them again, in a new order) and a `stop`
 * channel sends nothing more. A batch never mixes two cycles.
 */
export function pickBatch(choice: Choice): Pick {
  const left = choice.ready.filter((id) => !choice.sent.has(id));
  const restart = left.length === 0 && choice.whenDone === 'restart' && choice.ready.length > 0;
  const pool = restart ? choice.ready : left;
  const questionIds = shuffled(pool).slice(0, choice.size);
  const cycle = restart ? choice.cycle + 1 : choice.cycle;
  const remaining = pool.length - questionIds.length;
  return { questionIds, cycle, done: choice.whenDone === 'stop' && remaining === 0 };
}

/** Whether a recipient's choice is the answer: the same letters, in any order. */
export function isCorrect(choice: readonly string[], answers: readonly string[]): boolean {
  const chosen = new Set(choice);
  return chosen.size === answers.length && answers.every((letter) => chosen.has(letter));
}
