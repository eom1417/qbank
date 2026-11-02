import { describe, expect, it } from 'vitest';
import { SignUpRequest } from '../../../src/contracts/identity.js';
import { AppError } from '../../../src/server/platform/errors/index.js';
import { parseInput } from '../../../src/server/platform/http/validate.js';

const valid = {
  email: ' A@B.Test ',
  password: 'long enough password',
  displayName: ' Sara ',
  locale: 'en',
  acceptTerms: true,
};

describe('parseInput', () => {
  it('normalizes email and trims the display name', () => {
    const parsed = parseInput(SignUpRequest, valid);
    expect(parsed.email).toBe('a@b.test');
    expect(parsed.displayName).toBe('Sara');
  });

  it('reports every invalid field by name', () => {
    const attempt = () => parseInput(SignUpRequest, { ...valid, email: 'nope', locale: 'fr' });
    expect(attempt).toThrow(AppError);
    try {
      attempt();
    } catch (error) {
      expect((error as AppError).fields).toEqual({
        email: 'invalid_format',
        locale: 'invalid_value',
      });
    }
  });
});
