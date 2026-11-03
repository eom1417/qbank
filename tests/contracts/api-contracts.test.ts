import { describe, expect, it } from 'vitest';
import { ProviderResponse } from '../../src/contracts/ai.js';
import { AccountResponse } from '../../src/contracts/identity.js';
import { BankResponse } from '../../src/contracts/library.js';
import { toProviderResponse } from '../../src/server/capabilities/ai/index.js';
import { toAccountResponse } from '../../src/server/capabilities/identity/index.js';
import { toBankResponse } from '../../src/server/capabilities/library/index.js';

const ID = '0b4f4a1e-7c3d-4c2a-9f0e-2d1b3c4d5e6f';
const AT = new Date('2026-11-02T08:00:00.000Z');

describe('public response contracts', () => {
  it('account response carries exactly the public fields (never a password hash)', () => {
    const preferences = {
      locale: 'ar',
      theme: 'system',
      defaultSessionSize: 20,
      explanationMode: 'after_answer',
    } as const;
    const account = { id: ID, email: 'a@b.test', displayName: 'A', preferences };
    const response = toAccountResponse({ ...account, passwordHash: 'secret' } as typeof account);
    expect(AccountResponse.parse(response)).toEqual(account);
    expect(Object.keys(response).sort()).toEqual(['displayName', 'email', 'id', 'preferences']);
  });

  it('bank response matches its schema with ISO dates and an archived flag', () => {
    const response = toBankResponse({
      id: ID,
      ownerId: ID,
      name: 'Bank',
      description: null,
      subject: 'Cardiology',
      archivedAt: null,
      createdAt: AT,
      updatedAt: AT,
    });
    expect(BankResponse.parse(response)).toEqual({
      id: ID,
      name: 'Bank',
      description: null,
      subject: 'Cardiology',
      archived: false,
      createdAt: '2026-11-02T08:00:00.000Z',
      updatedAt: '2026-11-02T08:00:00.000Z',
    });
  });
});

describe('AI provider contract', () => {
  it('carries a key hint but never the sealed or clear key', () => {
    const response = toProviderResponse({
      id: ID,
      ownerId: ID,
      kind: 'openai_compatible',
      label: 'Cloud',
      baseUrl: 'https://ai.example/v1',
      accountEmail: null,
      accountPlan: null,
      model: 'm',
      keyCiphertext: 'v1:sealed',
      keyHint: '3f9a',
      inputPrice: 1,
      outputPrice: null,
      isDefault: true,
      readinessStatus: 'ready',
      readinessCheckedAt: AT,
      createdAt: AT,
      updatedAt: AT,
    });
    expect(ProviderResponse.parse(response)).toEqual(response);
    expect(response.keyHint).toBe('••••3f9a');
    expect(response.readiness).toEqual({ status: 'ready', checkedAt: '2026-11-02T08:00:00.000Z' });
    expect(JSON.stringify(response)).not.toContain('sealed');
  });
});
