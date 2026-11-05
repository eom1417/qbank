import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/server/platform/config/index.js';

const server = {
  QBANK_MODE: 'accounts',
  DATABASE_URL: 'postgres://user:secret@db/qbank',
  QBANK_AI_HOST_TOKEN: 'x'.repeat(40),
  ANTHROPIC_API_KEY: 'sk-ant-operator',
  PATH: '/usr/bin',
  LANG: 'C.UTF-8',
};

describe('AI hosts configuration (DEC-35)', () => {
  it('gives accounts a host each, inheriting only what runs a program', () => {
    const { aiHosts } = loadConfig(server);
    expect(aiHosts.mode).toBe('per_account');
    expect(aiHosts.inherited).toEqual({ PATH: '/usr/bin', LANG: 'C.UTF-8' });
    expect(aiHosts.idleMs).toBe(15 * 60_000);
  });

  it('keeps one host locally, and on the roll-back switch', () => {
    expect(loadConfig({ QBANK_MODE: 'local' }).aiHosts.mode).toBe('single');
    expect(loadConfig({ ...server, QBANK_AI_HOSTS: 'single' }).aiHosts.mode).toBe('single');
  });
});
