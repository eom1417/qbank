import { describe, expect, it } from 'vitest';
import { isAllowedEndpoint } from '../../../src/server/capabilities/ai/adapters/endpoint-guard.js';

describe('provider URL guard (SSRF)', () => {
  it.each([
    'http://8.8.8.8/v1',
    'https://127.0.0.1/v1',
    'https://10.1.2.3/v1',
    'https://192.168.0.10/v1',
    'https://169.254.169.254/latest',
    'https://[::1]/v1',
    'https://[::ffff:127.0.0.1]/v1',
    'https://[fd00::1]/v1',
    'https://user@8.8.8.8/v1',
    'ftp://8.8.8.8/v1',
    'not a url',
  ])('rejects %s', async (url) => {
    expect(await isAllowedEndpoint(url, false)).toBe(false);
  });

  it('accepts https to a public address', async () => {
    expect(await isAllowedEndpoint('https://8.8.8.8/v1', false)).toBe(true);
  });

  it('allows private http hosts only when the operator enables it', async () => {
    expect(await isAllowedEndpoint('http://127.0.0.1:11434/v1', true)).toBe(true);
    expect(await isAllowedEndpoint('file:///etc/passwd', true)).toBe(false);
  });
});
