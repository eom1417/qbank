import { describe, expect, it } from 'vitest';
import {
  hashSessionToken,
  generateSessionToken,
} from '../../../src/server/capabilities/identity/adapters/session-tokens.js';
import { sessionExpiresAt } from '../../../src/server/capabilities/identity/domain/session.js';

describe('sessions', () => {
  it('expires after the configured number of days', () => {
    const now = new Date('2026-11-02T10:00:00Z');
    expect(sessionExpiresAt(now, 30).toISOString()).toBe('2026-12-02T10:00:00.000Z');
  });

  it('stores only a hash that differs from the bearer token', () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(43);
    expect(hashSessionToken(token)).not.toContain(token);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(generateSessionToken()).not.toBe(token);
  });
});
