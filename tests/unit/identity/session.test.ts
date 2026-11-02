import { describe, expect, it } from 'vitest';
import {
  generateToken,
  hashToken,
} from '../../../src/server/capabilities/identity/adapters/tokens.js';
import {
  resetEmail,
  resetExpiresAt,
} from '../../../src/server/capabilities/identity/domain/password-reset.js';
import { sessionExpiresAt } from '../../../src/server/capabilities/identity/domain/session.js';

describe('sessions', () => {
  it('expires after the configured number of days', () => {
    const now = new Date('2026-11-02T10:00:00Z');
    expect(sessionExpiresAt(now, 30).toISOString()).toBe('2026-12-02T10:00:00.000Z');
  });

  it('stores only a hash that differs from the bearer token', () => {
    const token = generateToken();
    expect(token).toHaveLength(43);
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(generateToken()).not.toBe(token);
  });
});

describe('password reset links', () => {
  it('expire after one hour and carry the token in the URL fragment only', () => {
    const now = new Date('2026-11-02T10:00:00Z');
    expect(resetExpiresAt(now).toISOString()).toBe('2026-11-02T11:00:00.000Z');
    const mail = resetEmail('en', 'https://app.test', 'TOKEN123');
    expect(mail.text).toContain('https://app.test/reset-password#token=TOKEN123');
    expect(resetEmail('ar', 'https://app.test', 'T').subject).toContain('كلمة المرور');
  });
});
