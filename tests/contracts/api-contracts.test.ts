import { describe, expect, it } from 'vitest';
import { AccountResponse } from '../../src/contracts/identity.js';
import { BankResponse } from '../../src/contracts/library.js';
import { toAccountResponse } from '../../src/server/capabilities/identity/index.js';
import { toBankResponse } from '../../src/server/capabilities/library/index.js';

const ID = '0b4f4a1e-7c3d-4c2a-9f0e-2d1b3c4d5e6f';
const AT = new Date('2026-11-02T08:00:00.000Z');

describe('public response contracts', () => {
  it('account response carries exactly the public fields (never a password hash)', () => {
    const account = {
      id: ID,
      email: 'a@b.test',
      displayName: 'A',
      locale: 'ar',
      theme: 'system',
    } as const;
    const response = toAccountResponse({ ...account, passwordHash: 'secret' } as typeof account);
    expect(AccountResponse.parse(response)).toEqual(account);
    expect(Object.keys(response).sort()).toEqual(['displayName', 'email', 'id', 'locale', 'theme']);
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
