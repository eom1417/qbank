import { randomInt } from 'node:crypto';
import { shuffled } from '../../exam-rules/index.js';

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

const SCALE = 2 ** 47;

/** A uniform number in [0, 1) from the system's cryptographic source, so batches stay fair. */
const secureRandom = () => randomInt(SCALE) / SCALE;

/**
 * The next batch: questions this cycle has not sent, at random. When every ready question has
 * gone, a `restart` channel begins a new cycle (all of them again, in a new order) and a `stop`
 * channel sends nothing more. A batch never mixes two cycles.
 */
export function pickBatch(choice: Choice): Pick {
  const left = choice.ready.filter((id) => !choice.sent.has(id));
  const restart = left.length === 0 && choice.whenDone === 'restart' && choice.ready.length > 0;
  const pool = restart ? choice.ready : left;
  const questionIds = shuffled(pool, secureRandom).slice(0, choice.size);
  const cycle = restart ? choice.cycle + 1 : choice.cycle;
  const remaining = pool.length - questionIds.length;
  return { questionIds, cycle, done: choice.whenDone === 'stop' && remaining === 0 };
}
