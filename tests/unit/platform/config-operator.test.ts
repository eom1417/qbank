import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/server/platform/config/index.js';

/** M31 (DEC-40): the operator and import-worker settings of a server install. */
const ACCOUNTS = { QBANK_MODE: 'accounts', DATABASE_URL: 'postgres://x@db/q' };

describe('operator and import-worker settings', () => {
  it('reads the operator, lower-casing the e-mail', () => {
    const config = loadConfig({
      ...ACCOUNTS,
      QBANK_OPERATOR_EMAIL: ' Admin@Example.com ',
      QBANK_OPERATOR_NAME: 'Abu Ali',
      QBANK_IMPORT_WORKERS: '3',
    });
    expect(config.operator).toEqual({ email: 'admin@example.com', name: 'Abu Ali' });
    expect(config.imports.workers).toBe(3);
  });

  it('treats a blank line in .env as unset instead of refusing to start', () => {
    const config = loadConfig({
      ...ACCOUNTS,
      QBANK_OPERATOR_EMAIL: '',
      QBANK_OPERATOR_NAME: '  ',
      QBANK_IMPORT_WORKERS: '',
    });
    expect(config.operator).toEqual({ email: null, name: null });
    expect(config.imports.workers).toBe(2);
  });

  it('refuses a value that is set but invalid', () => {
    expect(() => loadConfig({ ...ACCOUNTS, QBANK_OPERATOR_EMAIL: 'not-an-email' })).toThrow();
    expect(() => loadConfig({ ...ACCOUNTS, QBANK_IMPORT_WORKERS: '9' })).toThrow();
  });

  it('gives a local install no operator even when one is configured', () => {
    const config = loadConfig({ QBANK_OPERATOR_EMAIL: 'admin@example.com' });
    expect(config.operator).toEqual({ email: null, name: null });
  });
});

// M38 (Q136): the rules alone read a file on a server too; an operator may still require the AI.
describe('imports with the AI only when the operator says so (Q7, Q136)', () => {
  it('does not require it by default, on a server or a local install', () => {
    expect(loadConfig(ACCOUNTS).imports.requiresAi).toBe(false);
    expect(loadConfig({}).imports.requiresAi).toBe(false);
    expect(loadConfig({ ...ACCOUNTS, QBANK_IMPORT_REQUIRES_AI: '' }).imports.requiresAi).toBe(
      false,
    );
  });

  it('requires it where the operator set it', () => {
    const on = { ...ACCOUNTS, QBANK_IMPORT_REQUIRES_AI: 'true' };
    expect(loadConfig(on).imports.requiresAi).toBe(true);
    expect(loadConfig({ QBANK_IMPORT_REQUIRES_AI: 'true' }).imports.requiresAi).toBe(true);
  });
});
