import { describe, expect, it } from 'vitest';
import { createSecretBox } from '../../../src/server/platform/crypto/secret-box.js';

const box = createSecretBox(Buffer.alloc(32, 1));
const KEY = 'sk-live-0123456789abcdef';

describe('secret box (AES-256-GCM, M2.1)', () => {
  it('opens what it sealed, for the same row only', () => {
    const sealed = box.seal(KEY, 'ai_provider:a:1');
    expect(sealed).not.toContain(KEY);
    expect(box.open(sealed, 'ai_provider:a:1')).toBe(KEY);
    expect(box.open(sealed, 'ai_provider:b:1')).toBeNull();
  });

  it('uses a fresh nonce per seal', () => {
    expect(box.seal(KEY, 'c')).not.toBe(box.seal(KEY, 'c'));
  });

  it('rejects tampered values, other master keys and garbage', () => {
    const sealed = box.seal(KEY, 'c');
    const [version, iv, tag, body = ''] = sealed.split(':');
    const flipped = `${body.startsWith('A') ? 'B' : 'A'}${body.slice(1)}`;
    expect(box.open([version, iv, tag, flipped].join(':'), 'c')).toBeNull();
    expect(createSecretBox(Buffer.alloc(32, 2)).open(sealed, 'c')).toBeNull();
    expect(box.open('not-sealed', 'c')).toBeNull();
    expect(box.open(`v0:${iv}:${tag}:${body}`, 'c')).toBeNull();
  });

  it('refuses a master key that is not 32 bytes', () => {
    expect(() => createSecretBox(Buffer.alloc(16))).toThrow(/32 bytes/);
  });
});
