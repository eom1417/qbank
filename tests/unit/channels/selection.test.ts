import { describe, expect, it } from 'vitest';
import { pickBatch } from '../../../src/server/capabilities/channels/domain/selection.js';
import { isCorrect } from '../../../src/server/capabilities/exam-rules/index.js';
import { createRateLimit } from '../../../src/server/platform/http/rate-limit.js';

const READY = ['a', 'b', 'c'];

describe('choosing the next batch (DEC-36)', () => {
  it('takes only questions this cycle has not sent, and never mixes cycles', () => {
    const pick = pickBatch({
      ready: READY,
      sent: new Set(['a', 'b']),
      cycle: 1,
      size: 3,
      whenDone: 'restart',
    });
    expect(pick).toEqual({ questionIds: ['c'], cycle: 1, done: false });
  });

  it('starts a new cycle with every question, or stops, when all have gone', () => {
    const all = new Set(READY);
    const restart = pickBatch({ ready: READY, sent: all, cycle: 1, size: 5, whenDone: 'restart' });
    expect([restart.cycle, restart.questionIds.sort()]).toEqual([2, READY]);
    const stop = pickBatch({ ready: READY, sent: all, cycle: 1, size: 5, whenDone: 'stop' });
    expect(stop).toEqual({ questionIds: [], cycle: 1, done: true });
    expect(
      pickBatch({ ready: [], sent: new Set(), cycle: 1, size: 2, whenDone: 'restart' }).questionIds,
    ).toEqual([]);
  });

  it('marks an answer right only with exactly the answer letters', () => {
    expect(isCorrect(['B'], ['B'])).toBe(true);
    expect(isCorrect(['C', 'A'], ['A', 'C'])).toBe(true);
    expect(isCorrect(['A'], ['A', 'C'])).toBe(false);
    expect(isCorrect(['A', 'B'], ['A'])).toBe(false);
  });
});

describe('the rate limit of a key', () => {
  it('refuses calls over the limit until the window turns', () => {
    let now = 0;
    const take = createRateLimit({ limit: 2, windowMs: 1000, now: () => now });
    take('k');
    take('k');
    expect(() => take('k')).toThrow('too_many_attempts');
    take('other');
    now = 1000;
    expect(() => take('k')).not.toThrow();
  });
});
