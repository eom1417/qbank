import { describe, expect, it } from 'vitest';
import { createAttemptLimiter } from '../../src/server/platform/http/attempts.js';

describe('the attempt limiter', () => {
  it('stays bounded when every request claims a new address', () => {
    const limiter = createAttemptLimiter({ max: 3, windowMs: 60_000, now: () => new Date(0) });
    for (let i = 0; i < 25_000; i++) limiter.fail(`spoofed-${i}`);
    expect(limiter.size()).toBeLessThanOrEqual(10_000);
  });

  it('forgets a caller whose failures have all expired', () => {
    let now = 0;
    const limiter = createAttemptLimiter({ max: 3, windowMs: 1000, now: () => new Date(now) });
    limiter.fail('a');
    now = 5000;
    expect(limiter.blocked('a')).toBe(false);
    expect(limiter.size()).toBe(0);
  });
});
