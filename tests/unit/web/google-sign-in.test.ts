import { describe, expect, it } from 'vitest';
import {
  googleError,
  googleStartUrl,
  safeNext,
} from '../../../src/web/capabilities/identity/google.js';

describe('Google sign-in in the browser (M32, DEC-42)', () => {
  it('starts on the server route with where to come back', () => {
    expect(googleStartUrl('/banks/1', false)).toBe('/api/auth/google/start?next=%2Fbanks%2F1');
  });

  it('adds the accepted terms only for sign-up', () => {
    expect(googleStartUrl('/', true)).toBe('/api/auth/google/start?next=%2F&acceptTerms=1');
  });

  it('keeps only a path on this site as the way back', () => {
    expect(safeNext('/sharing?x=1')).toBe('/sharing?x=1');
    for (const unsafe of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test', 'banks'])
      expect(safeNext(unsafe)).toBe('/');
    expect(googleStartUrl('//evil.test', false)).toBe('/api/auth/google/start?next=%2F');
  });

  it('reads why the server sent the browser back', () => {
    expect(googleError('?error=google')).toBe('google');
    expect(googleError('?next=%2F&error=terms')).toBe('terms');
    expect(googleError('?error=too_many_attempts')).toBe('too_many_attempts');
    expect(googleError('?error=other')).toBeNull();
    expect(googleError('')).toBeNull();
  });
});
