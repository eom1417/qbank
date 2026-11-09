import { describe, expect, it } from 'vitest';
import { KitMethod, ProviderView } from '../../src/contracts/providers.js';
import { AccountResponse } from '../../src/contracts/identity.js';
import { BankResponse } from '../../src/contracts/library.js';
import { toAccountResponse } from '../../src/server/capabilities/identity/index.js';
import { toBankResponse } from '../../src/server/capabilities/library/index.js';

const ID = '0b4f4a1e-7c3d-4c2a-9f0e-2d1b3c4d5e6f';
const AT = new Date('2026-11-02T08:00:00.000Z');

describe('public response contracts', () => {
  it('account response carries exactly the public fields (never a password hash)', () => {
    const preferences = {
      locale: 'ar',
      theme: 'system',
      skin: 'clinic',
      defaultSessionSize: 20,
      explanationMode: 'after_answer',
      reviewReminders: 'off',
    } as const;
    const account = { id: ID, email: 'a@b.test', displayName: 'A', preferences };
    const withHash = { ...account, passwordHash: 'secret' } as typeof account;
    const response = toAccountResponse(withHash, false);
    expect(AccountResponse.parse(response)).toEqual({ ...account, isOperator: false });
    expect(Object.keys(response).sort()).toEqual([
      'displayName',
      'email',
      'id',
      'isOperator',
      'preferences',
    ]);
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

describe('AI providers contract (the kit, DEC-30)', () => {
  it('passes only the allowlisted kit methods through', () => {
    expect(KitMethod.safeParse('server.refreshProviders').success).toBe(true);
    expect(KitMethod.safeParse('server.getConfig').success).toBe(false);
    expect(KitMethod.safeParse('orchestration.dispatchCommand').success).toBe(false);
  });

  it('reads a provider snapshot and keeps the fields it does not name', () => {
    const provider = {
      instanceId: 'codex',
      driver: 'codex',
      enabled: true,
      installed: true,
      version: '0.50.0',
      status: 'ready',
      auth: { status: 'authenticated', email: 'a@b.test' },
      models: [{ slug: 'gpt-5', name: 'GPT-5', isDefault: true }],
      checkedAt: '2026-11-02T08:00:00.000Z',
    };
    expect(ProviderView.parse(provider)).toEqual(provider);
    expect(ProviderView.safeParse({ ...provider, status: 'odd' }).success).toBe(false);
  });
});
